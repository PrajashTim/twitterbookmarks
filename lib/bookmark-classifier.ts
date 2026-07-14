export interface CategoryMatch {
  slug: string
  confidence: number
}

const RULES: Array<[string, RegExp[]]> = [
  ['ai-resources', [
    /\bai\b/i, /artificial intelligence/i, /machine learning/i, /\bllms?\b/i,
    /chatgpt/i, /openai/i, /claude/i, /gemini/i, /midjourney/i, /prompt/i,
  ]],
  ['finance-crypto', [
    /crypto/i, /bitcoin/i, /\bbtc\b/i, /ethereum/i, /\beth\b/i, /solana/i,
    /blockchain/i, /web3/i, /defi/i, /airdrop/i, /memecoin/i, /\bnft\b/i,
  ]],
  ['dev-tools', [
    /software engineer/i, /developer/i, /programming/i, /\bcoding?\b/i,
    /github/i, /open source/i, /\bapi\b/i, /database/i, /typescript/i,
    /javascript/i, /python/i, /\breact\b/i, /next\.js/i, /docker/i, /vercel/i,
  ]],
  ['technology-gadgets', [
    /\btechnology\b/i, /gadget/i, /iphone/i, /android/i, /smartphone/i,
    /macbook/i, /\blaptop\b/i, /computer/i, /camera/i, /headphones/i, /hardware/i,
  ]],
  ['finance-investing', [
    /invest(?:ing|ment|or)?/i, /stock market/i, /\bstocks?\b/i, /portfolio/i,
    /interest rates?/i, /federal reserve/i, /private equity/i, /real estate/i,
  ]],
  ['startups-business', [
    /startups?/i, /founders?/i, /entrepreneur/i, /\bsaas\b/i, /fundraising/i,
    /venture capital/i, /bootstrapp/i, /\bbusiness\b/i, /revenue/i, /customers?/i,
  ]],
  ['marketing-growth', [
    /marketing/i, /advertis/i, /\bads?\b/i, /copywriting/i, /media buying/i,
    /\bseo\b/i, /newsletter/i, /conversion/i, /lead gen/i, /youtube/i,
    /personal brand/i, /sales funnel/i, /\bviral\b/i,
  ]],
  ['news', [
    /breaking news/i, /politics/i, /political/i, /election/i, /president/i,
    /government/i, /congress/i, /geopolitic/i, /foreign policy/i,
  ]],
  ['design', [
    /\bdesign(?:er|ing)?\b/i, /\bui\b/i, /\bux\b/i, /figma/i, /typography/i,
    /design system/i, /landing page/i, /brand identity/i, /web design/i,
  ]],
  ['health-wellness', [
    /health/i, /fitness/i, /workout/i, /\bgym\b/i, /exercise/i, /nutrition/i,
    /protein/i, /diet/i, /weight loss/i, /longevity/i, /sleep/i, /supplement/i,
  ]],
  ['fashion-style', [
    /fashion/i, /outfits?/i, /wardrobe/i, /clothing/i, /menswear/i, /womenswear/i,
    /streetwear/i, /styling/i, /\bshoes?\b/i, /sneakers?/i, /\bjacket\b/i,
  ]],
  ['beauty-skincare', [
    /skincare/i, /\bacne\b/i, /dermatolog/i, /cosmetic/i, /makeup/i, /hair care/i,
    /grooming/i, /fragrance/i, /perfume/i, /moisturi/i, /sunscreen/i,
  ]],
  ['dating-relationships', [
    /\bdating\b/i, /first date/i, /relationship/i, /girlfriend/i, /boyfriend/i,
    /marriage/i, /breakup/i, /attraction/i, /flirting/i, /romantic/i, /intimacy/i,
    /\bwom[ae]n\b/i, /\bgirls?\b/i, /\bhinge\b/i, /\brizz\b/i, /text game/i,
  ]],
  ['security-privacy', [
    /cybersecurity/i, /\bhacking?\b/i, /exploit/i, /vulnerabilit/i, /malware/i,
    /phishing/i, /data breach/i, /\bprivacy\b/i, /encryption/i, /\bvpn\b/i,
  ]],
  ['science-research', [
    /scientific/i, /\bresearch(?:ers?)?\b/i, /research paper/i, /physics/i,
    /biology/i, /neuroscience/i, /astronomy/i, /quantum/i, /clinical trial/i,
  ]],
  ['productivity', [
    /productivity/i, /time management/i, /deep work/i, /\bfocus\b/i,
    /note[- ]taking/i, /second brain/i, /\bnotion\b/i, /obsidian/i, /workflow/i,
    /automation/i, /daily routine/i,
  ]],
  ['funny-memes', [
    /\bmemes?\b/i, /\bfunny\b/i, /\bjoke\b/i, /\blmao\b/i, /\blol\b/i,
    /shitpost/i, /parody/i, /satire/i,
  ]],
]

function score(text: string, patterns: RegExp[]): number {
  return patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0)
}

export function classifyBookmark(text: string): CategoryMatch[] {
  const ranked = RULES
    .map(([slug, patterns]) => ({ slug, score: score(text, patterns) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)

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
