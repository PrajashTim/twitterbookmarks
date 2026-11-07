import React from 'react'
import { WORD_SUFFIX, stem } from '@/lib/search'

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Build one regex that matches any search term (whole word for short terms, word-prefix otherwise). */
export function buildHighlightRegex(terms: string[] | undefined): RegExp | null {
  const parts = (terms ?? [])
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2)
    .sort((a, b) => b.length - a.length)
    .map((t) => {
      if (t.length <= 3 || t.includes(' ')) return `${escapeRegex(t)}(?![\\p{L}\\p{N}])`
      return `${escapeRegex(stem(t))}${WORD_SUFFIX}(?![\\p{L}\\p{N}])`
    })
  if (parts.length === 0) return null
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.join('|')})`, 'giu')
}

export function highlightText(text: string, regex: RegExp | null): React.ReactNode {
  if (!regex || !text) return text
  const out: React.ReactNode[] = []
  let last = 0
  regex.lastIndex = 0
  for (const match of text.matchAll(regex)) {
    const index = match.index ?? 0
    if (index > last) out.push(text.slice(last, index))
    out.push(<mark key={index} className="search-hit">{match[0]}</mark>)
    last = index + match[0].length
  }
  if (last === 0) return text
  if (last < text.length) out.push(text.slice(last))
  return out
}
