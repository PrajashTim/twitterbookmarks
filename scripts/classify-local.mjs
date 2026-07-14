import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const db = new Database(path.join(projectRoot, 'prisma', 'dev.db'))

const rules = [
  ['ai-resources', [
    /\bai\b/gi, /artificial intelligence/gi, /machine learning/gi, /\bllms?\b/gi,
    /chatgpt/gi, /openai/gi, /claude/gi, /gemini/gi, /midjourney/gi,
    /prompt(?:ing|s)?/gi, /ai agent/gi, /neural network/gi, /fine[- ]tun/gi,
  ]],
  ['finance-crypto', [
    /crypto/gi, /bitcoin/gi, /\bbtc\b/gi, /ethereum/gi, /\beth\b/gi,
    /solana/gi, /blockchain/gi, /web3/gi, /defi/gi, /airdrop/gi,
    /memecoin/gi, /smart contract/gi, /on[- ]chain/gi, /nft/gi,
  ]],
  ['dev-tools', [
    /software engineer/gi, /developer/gi, /programming/gi, /\bcoding?\b/gi,
    /github/gi, /open source/gi, /\bapi\b/gi, /database/gi, /typescript/gi,
    /javascript/gi, /python/gi, /\breact\b/gi, /next\.js/gi, /docker/gi,
    /vercel/gi, /supabase/gi, /terminal/gi, /debug/gi, /devops/gi,
    /\bcli\b/gi, /\bmcp\b/gi, /codex/gi, /ollama/gi, /source code/gi,
  ]],
  ['technology-gadgets', [
    /\btech(?:nology)?\b/gi, /gadget/gi, /iphone/gi, /android/gi, /smartphone/gi,
    /macbook/gi, /\blaptop\b/gi, /computer/gi, /camera/gi, /headphones/gi,
    /wearable/gi, /smart home/gi, /hardware/gi, /device/gi, /browser/gi,
  ]],
  ['finance-investing', [
    /invest(?:ing|ment|or)?/gi, /stock market/gi, /\bstocks?\b/gi, /equities/gi,
    /options trading/gi, /portfolio/gi, /interest rates?/gi, /federal reserve/gi,
    /hedge fund/gi, /private equity/gi, /real estate/gi, /financial/gi,
    /wealth/gi, /market cap/gi, /earnings/gi,
  ]],
  ['startups-business', [
    /startups?/gi, /founders?/gi, /entrepreneur/gi, /\bsaas\b/gi,
    /product[- ]market fit/gi, /fundraising/gi, /venture capital/gi,
    /bootstrapp/gi, /y combinator/gi, /\bbusiness\b/gi, /revenue/gi,
    /sales (?:team|process|strategy)/gi, /acquisition/gi, /\bproduct\b/gi,
    /customers?/gi, /\bclients?\b/gi, /pricing/gi, /\bcompany\b/gi,
    /make money/gi, /\bincome\b/gi, /business model/gi,
  ]],
  ['marketing-growth', [
    /marketing/gi, /advertis/gi, /\bads?\b/gi, /ad creative/gi, /copywriting/gi,
    /media buying/gi, /\bseo\b/gi, /email list/gi, /newsletter/gi,
    /customer acquisition/gi, /conversion/gi, /lead gen/gi, /audience growth/gi,
    /social media strategy/gi, /brand strategy/gi, /youtube/gi,
    /instagram/gi, /\bcontent\b/gi, /\bleads?\b/gi, /organically/gi,
    /thumbnail/gi, /\bchannel\b/gi, /\bviral\b/gi, /\bviews\b/gi,
    /sales funnel/gi, /direct response/gi, /personal brand/gi,
  ]],
  ['news', [
    /breaking news/gi, /politics/gi, /political/gi, /election/gi, /president/gi,
    /government/gi, /congress/gi, /geopolitic/gi, /regulation/gi,
    /journalis/gi, /foreign policy/gi, /international relations/gi,
  ]],
  ['design', [
    /\bdesign(?:er|ing)?\b/gi, /\bui\b/gi, /\bux\b/gi, /figma/gi,
    /typography/gi, /design system/gi, /landing page/gi, /wireframe/gi,
    /brand identity/gi, /logo/gi, /color palette/gi, /web design/gi,
  ]],
  ['health-wellness', [
    /health/gi, /fitness/gi, /workout/gi, /\bgym\b/gi, /exercise/gi,
    /nutrition/gi, /protein/gi, /diet/gi, /weight loss/gi, /muscle/gi,
    /longevity/gi, /sleep/gi, /mental health/gi, /supplement/gi,
    /meditat/gi, /testosterone/gi, /blood pressure/gi,
  ]],
  ['fashion-style', [
    /fashion/gi, /outfits?/gi, /wardrobe/gi, /clothing/gi, /menswear/gi,
    /womenswear/gi, /streetwear/gi, /styling/gi, /\bshirt\b/gi, /\bjeans\b/gi,
    /\bshoes?\b/gi, /sneakers?/gi, /\bjacket\b/gi, /\bsuit\b/gi,
  ]],
  ['beauty-skincare', [
    /skincare/gi, /\bacne\b/gi, /dermatolog/gi, /cosmetic/gi, /makeup/gi,
    /hair care/gi, /haircut/gi, /grooming/gi, /fragrance/gi, /perfume/gi,
    /skin routine/gi, /moisturi/gi, /sunscreen/gi, /appearance/gi,
  ]],
  ['dating-relationships', [
    /\bdating\b/gi, /first date/gi, /relationship/gi, /girlfriend/gi,
    /boyfriend/gi, /wife/gi, /husband/gi, /marriage/gi, /breakup/gi,
    /attraction/gi, /flirting/gi, /romantic/gi, /intimacy/gi,
    /\bcouple\b/gi, /life partner/gi, /dating app/gi, /\bwom[ae]n\b/gi,
    /\bgirls?\b/gi, /\bguys?\b/gi, /\bapproach(?:ing)?\b/gi,
    /choosing signals/gi, /text game/gi, /\bhinge\b/gi, /\brizz\b/gi,
    /the real game/gi, /realgame101/gi, /girls chase/gi, /cultured hedonist/gi,
    /sexual/gi, /\bsex\b/gi, /\bkiss(?:ing)?\b/gi, /\bghost(?:s|ed|ing)?\b/gi,
  ]],
  ['security-privacy', [
    /cybersecurity/gi, /\bhacking?\b/gi, /exploit/gi, /vulnerabilit/gi,
    /malware/gi, /phishing/gi, /ransomware/gi, /data breach/gi,
    /\bprivacy\b/gi, /encryption/gi, /\bvpn\b/gi, /password/gi,
    /authentication/gi, /zero[- ]day/gi,
  ]],
  ['science-research', [
    /scientific/gi, /\bresearch(?:ers?)?\b/gi, /\bstud(?:y|ies)\b/gi,
    /research paper/gi, /physics/gi, /biology/gi, /neuroscience/gi,
    /astronomy/gi, /space exploration/gi, /quantum/gi, /robotics/gi,
    /clinical trial/gi, /scientists?/gi,
  ]],
  ['productivity', [
    /productivity/gi, /time management/gi, /deep work/gi, /\bfocus\b/gi,
    /note[- ]taking/gi, /second brain/gi, /\bnotion\b/gi, /obsidian/gi,
    /\bhabits?\b/gi, /workflow/gi, /automation/gi, /mental model/gi,
    /daily routine/gi, /goal setting/gi,
  ]],
  ['funny-memes', [
    /\bmeme\b/gi, /\bmemes\b/gi, /\bfunny\b/gi, /\bjoke\b/gi,
    /\blmao\b/gi, /\blol\b/gi, /shitpost/gi, /parody/gi, /satire/gi,
  ]],
]

function score(text, patterns) {
  return patterns.reduce((total, pattern) => {
    pattern.lastIndex = 0
    return total + Math.min((text.match(pattern) ?? []).length, 3)
  }, 0)
}

function classify(text) {
  const ranked = rules
    .map(([slug, patterns]) => ({ slug, score: score(text, patterns) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)

  if (ranked.length === 0) return [{ slug: 'general', confidence: 0.55 }]

  const strongest = ranked[0].score
  return ranked
    .filter((item, index) => index === 0 || item.score >= Math.max(2, strongest - 1))
    .slice(0, 3)
    .map((item) => ({
      slug: item.slug,
      confidence: Math.min(0.94, 0.62 + item.score * 0.07),
    }))
}

const categories = new Map(
  db.prepare('SELECT id, slug FROM Category').all().map((row) => [row.slug, row.id]),
)
const bookmarks = db.prepare('SELECT id, text, authorName, authorHandle FROM Bookmark').all()
const insert = db.prepare(`
  INSERT INTO BookmarkCategory (bookmarkId, categoryId, confidence)
  VALUES (?, ?, ?)
  ON CONFLICT(bookmarkId, categoryId) DO UPDATE SET confidence = excluded.confidence
`)
const markClassified = db.prepare('UPDATE Bookmark SET enrichedAt = ? WHERE id = ?')

if (process.argv.includes('--reset')) {
  db.prepare('DELETE FROM BookmarkCategory').run()
}

let assignments = 0
let general = 0
const classifiedAt = new Date().toISOString()
const classified = bookmarks.map((bookmark) => ({
  bookmark,
  matches: classify(`${bookmark.text}\n${bookmark.authorName}\n${bookmark.authorHandle}`),
}))
const authorSignals = new Map()

for (const { bookmark, matches } of classified) {
  const topical = matches.filter((match) => match.slug !== 'general')
  if (topical.length === 0) continue

  const handle = bookmark.authorHandle.toLowerCase()
  const counts = authorSignals.get(handle) ?? new Map()
  for (const match of topical) {
    counts.set(match.slug, (counts.get(match.slug) ?? 0) + 1)
  }
  authorSignals.set(handle, counts)
}

const run = db.transaction(() => {
  for (const item of classified) {
    const { bookmark } = item
    let { matches } = item

    if (matches[0]?.slug === 'general') {
      const counts = authorSignals.get(bookmark.authorHandle.toLowerCase())
      if (counts) {
        const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
        const total = ranked.reduce((sum, [, count]) => sum + count, 0)
        const [slug, count] = ranked[0]
        if (count >= 2 && count / total >= 0.55) {
          matches = [{ slug, confidence: 0.6 }]
        }
      }
    }

    for (const match of matches) {
      const categoryId = categories.get(match.slug)
      if (!categoryId) continue
      insert.run(bookmark.id, categoryId, match.confidence)
      assignments++
      if (match.slug === 'general') general++
    }
    markClassified.run(classifiedAt, bookmark.id)
  }
})

run()
db.close()

console.log(JSON.stringify({ bookmarks: bookmarks.length, assignments, general }, null, 2))
