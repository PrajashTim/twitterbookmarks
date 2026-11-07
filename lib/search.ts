/**
 * Keyword search for the bookmark library.
 *
 * Query syntax:
 *   cold email offer     every word must match (text, author, or category), ranked by relevance
 *   "exact phrase"       phrase must appear in the tweet text
 *   @handle / from:x     only bookmarks by that author
 *   -word                exclude bookmarks containing the word
 *
 * If no bookmark matches every word, the search falls back to "any word" mode so
 * the user still sees the closest results instead of an empty page.
 */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'in', 'on', 'at', 'to', 'of', 'is', 'it', 'about',
  'that', 'with', 'by', 'this', 'my', 'me', 'i', 'some', 'any', 'show', 'find', 'from',
  'how', 'what', 'tweets', 'tweet', 'posts', 'post', 'bookmarks', 'bookmark', 'stuff',
])

/** Lightweight synonyms so common shorthand finds the long form and vice versa. */
const SYNONYMS: Record<string, string[]> = {
  ai: ['artificial intelligence', 'llm', 'claude', 'chatgpt', 'openai'],
  llm: ['ai', 'language model'],
  yt: ['youtube'],
  youtube: ['yt'],
  gf: ['girlfriend'],
  bf: ['boyfriend'],
  ig: ['instagram'],
  insta: ['instagram'],
  email: ['e-mail', 'emails'],
  ads: ['advertising', 'ad creative'],
  ecom: ['ecommerce', 'e-commerce'],
  vid: ['video'],
  vids: ['videos'],
  edit: ['editing', 'editor'],
  editing: ['edit', 'editor'],
  soccer: ['football'],
  football: ['soccer'],
  gym: ['workout', 'lifting'],
  workout: ['gym', 'exercise'],
  dating: ['date', 'women', 'girl'],
}

export interface ParsedQuery {
  terms: string[]
  phrases: string[]
  excludes: string[]
  authors: string[]
  /** Words to highlight in results (terms, phrases, and synonym hits) */
  highlight: string[]
}

export function parseSearchQuery(raw: string): ParsedQuery {
  const phrases: string[] = []
  const withoutPhrases = raw.replace(/"([^"]+)"/g, (_, phrase: string) => {
    const clean = phrase.trim().toLowerCase()
    if (clean) phrases.push(clean)
    return ' '
  })

  const terms: string[] = []
  const excludes: string[] = []
  const authors: string[] = []

  for (const token of withoutPhrases.split(/\s+/).filter(Boolean)) {
    const lower = token.toLowerCase()
    if (lower.startsWith('@') || lower.startsWith('from:')) {
      const handle = lower.replace(/^(from:)?@?/, '').replace(/[^a-z0-9_]/g, '')
      if (handle) authors.push(handle)
      continue
    }
    if (lower.startsWith('-') && lower.length > 2) {
      excludes.push(lower.slice(1).replace(/[^\p{L}\p{N}'#$.+-]/gu, ''))
      continue
    }
    const clean = lower.replace(/^[^\p{L}\p{N}#$]+|[^\p{L}\p{N}+]+$/gu, '')
    if (clean) terms.push(clean)
  }

  // Drop stop words unless that would leave nothing to search for.
  const meaningful = terms.filter((term) => !STOP_WORDS.has(term))
  const finalTerms = [...new Set(meaningful.length > 0 ? meaningful : terms)].slice(0, 8)

  return {
    terms: finalTerms,
    phrases,
    excludes: excludes.filter(Boolean),
    authors,
    highlight: [...finalTerms, ...phrases, ...finalTerms.flatMap((t) => SYNONYMS[t] ?? [])],
  }
}

/** Crude stemmer: "agencies" → "agenc", "editing" → "edit", "videos" → "video". */
export function stem(term: string): string {
  if (term.length > 4 && term.endsWith('ies')) return term.slice(0, -3)
  if (term.length > 5 && term.endsWith('ing')) return term.slice(0, -3)
  if (term.length > 4 && term.endsWith('ed')) return term.slice(0, -2)
  if (term.length > 3 && term.endsWith('s') && !term.endsWith('ss')) return term.slice(0, -1)
  return term
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Common English word endings, so "light" finds "lighting" but not "Lightreel". */
export const WORD_SUFFIX = '(?:s|es|ed|ing|ings|er|ers|or|ors|y|ies|ion|ions|ly|al)?'

/**
 * Regex for a search term: whole word for short terms, stem + common endings for longer ones.
 * `loose` allows any continuation (used for author names/handles like "AaronxShepherd").
 */
export function termRegex(term: string, loose = false): RegExp {
  const isWordy = /^[\p{L}\p{N}]/u.test(term)
  const start = isWordy ? '(?<![\\p{L}\\p{N}])' : ''
  const end = /[\p{L}\p{N}]$/u.test(term) ? '(?![\\p{L}\\p{N}])' : ''
  if (loose) return new RegExp(`${start}${escapeRegex(term)}`, 'iu')
  if (term.length <= 3 || term.includes(' ')) {
    return new RegExp(`${start}${escapeRegex(term)}${end}`, 'iu')
  }
  return new RegExp(`${start}${escapeRegex(stem(term))}${WORD_SUFFIX}${end}`, 'iu')
}

/** SQL prefilter fragment (superset) for a term: LIKE on the stem or any synonym. */
export function sqlVariants(term: string): string[] {
  return [stem(term), ...(SYNONYMS[term] ?? [])]
}

export interface SearchCandidate {
  id: string
  text: string
  authorName: string
  authorHandle: string
  semanticTags: string | null
  tweetCreatedAt: Date | null
  importedAt: Date
  categoryNames: string[]
}

export interface ScoredCandidate {
  id: string
  score: number
  matchedTerms: number
}

function scoreTerm(term: string, c: SearchCandidate): number {
  const exact = termRegex(term)
  const variants = SYNONYMS[term] ?? []
  let best = 0

  const authorRe = termRegex(term, true)
  if (authorRe.test(c.authorHandle) || authorRe.test(c.authorName)) best = Math.max(best, 4)
  if (exact.test(c.text)) {
    const wholeWord = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(term)}(?![\\p{L}\\p{N}])`, 'iu').test(c.text)
    const occurrences = (c.text.match(new RegExp(exact.source, 'giu')) ?? []).length
    best = Math.max(best, (wholeWord ? 3 : 2.2) + Math.min(occurrences - 1, 3) * 0.3)
  }
  if (c.categoryNames.some((name) => exact.test(name))) best = Math.max(best, 1.8)
  if (c.semanticTags && exact.test(c.semanticTags)) best = Math.max(best, 1.5)
  if (best === 0) {
    for (const variant of variants) {
      const re = termRegex(variant)
      if (re.test(c.text) || c.categoryNames.some((name) => re.test(name))) {
        best = Math.max(best, 1.6)
      }
    }
  }
  return best
}

export function scoreCandidates(
  candidates: SearchCandidate[],
  query: ParsedQuery,
  mode: 'all' | 'any',
): ScoredCandidate[] {
  const excludeRegexes = query.excludes.map((term) => termRegex(term))
  const now = Date.now()
  const results: ScoredCandidate[] = []

  for (const c of candidates) {
    const lowerText = c.text.toLowerCase()
    if (excludeRegexes.some((re) => re.test(c.text))) continue
    if (query.authors.length > 0 && !query.authors.some((a) => c.authorHandle.toLowerCase().includes(a))) continue
    if (!query.phrases.every((phrase) => lowerText.includes(phrase))) continue

    let score = query.phrases.length * 5
    let matchedTerms = 0
    for (const term of query.terms) {
      const termScore = scoreTerm(term, c)
      if (termScore > 0) matchedTerms++
      score += termScore
    }

    if (query.terms.length > 0) {
      if (mode === 'all' && matchedTerms < query.terms.length) continue
      if (mode === 'any' && matchedTerms === 0) continue
      // Reward results where the words appear close together.
      if (matchedTerms === query.terms.length && query.terms.length > 1) {
        const joined = query.terms.map((t) => escapeRegex(stem(t))).join('[\\s\\S]{0,40}')
        if (new RegExp(joined, 'iu').test(c.text)) score += 3
      }
      score += matchedTerms * 4
    }

    // Small recency tiebreaker (max +1 for brand new, fading over ~a year).
    const date = (c.tweetCreatedAt ?? c.importedAt).getTime()
    score += Math.max(0, 1 - (now - date) / (365 * 24 * 3600 * 1000))

    results.push({ id: c.id, score, matchedTerms })
  }

  return results.sort((a, b) => b.score - a.score)
}

export function hasSearch(query: ParsedQuery): boolean {
  return query.terms.length + query.phrases.length + query.authors.length + query.excludes.length > 0
}
