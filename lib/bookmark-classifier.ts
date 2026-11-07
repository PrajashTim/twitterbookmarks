/**
 * Rule-based bookmark classifier.
 *
 * Runs on every sync (no AI key needed on the cloud deployment). Each category has
 * weighted patterns: strong, unambiguous terms weigh 2-3, weaker hints weigh 1, and
 * very generic hints (like "she"/"her") weigh 0.5 so they only tip the balance when
 * something else agrees. A category needs a score of at least 1.5 to be assigned.
 */

export interface CategoryMatch {
  slug: string
  confidence: number
}

export interface CategoryDefinition {
  slug: string
  name: string
  color: string
  description: string
  rules: Array<[RegExp, number]>
}

const w = (weight: number, ...patterns: RegExp[]): Array<[RegExp, number]> =>
  patterns.map((pattern) => [pattern, weight])

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    slug: 'ai-resources',
    name: 'AI & Machine Learning',
    color: '#8b5cf6',
    description: 'AI models, agents, LLM tools, prompts, local models, AI image and video generation',
    rules: [
      ...w(3, /\bai agents?\b/i, /\bllms?\b/i, /chatgpt/i, /openai/i, /\bclaude\b/i, /anthropic/i,
        /\bgemini\b/i, /midjourney/i, /\bopus\s?\d/i, /\bsonnet\b/i, /\bgpt[- ]?\d/i, /\bqwen\b/i,
        /\bkimi\b/i, /\bgemma\b/i, /\bgrok\b/i, /openclaw|clawdbot|moltbot/i, /\bmcp\b/i,
        /seedance|higgsfield|hyperframes|nano banana|\bsora\b|\bveo\s?\d|\bkling\b|runway ml/i,
        /hugging ?face|gguf|\bmlx\b|lm studio|ollama|minimax|deepseek|\bglm\b/i,
        /machine learning|artificial intelligence|neural net|fine[- ]tun|embedding model/i),
      ...w(2, /\bai\b/i, /\bagents?\b/i, /\bprompts?\b/i, /\bmodels?\b/i, /codex|opencode|cursor ai/i,
        /uncensored|open[- ]?source model|local model|inference/i, /agentic/i),
    ],
  },
  {
    slug: 'sales-outreach',
    name: 'Sales & Outreach',
    color: '#f97316',
    description: 'Cold email, cold calling, offers, lead generation, closing deals, agency client acquisition',
    rules: [
      ...w(3, /cold (email|call|outreach|dm)s?/i, /\boutreach\b/i, /\bleads?\b(?! to)/i, /lead gen/i,
        /\bclose[sd]? (a |the )?deals?\b|\bclosing\b/i, /\bprospect(s|ing)?\b/i, /\bb2b\b/i,
        /meetings? booked|book(ed)? (more )?(calls|meetings)/i, /\bsales\b/i, /\bobjections?\b/i,
        /\bfollow[- ]?ups?\b/i, /reply rates?|replies from/i, /\bapollo\b|listkit|instantly\.ai|\bclay\b/i,
        /\bcall[- ]?to[- ]?actions?\b|\bctas?\b/i),
      ...w(2, /\boffers?\b/i, /\bclients?\b/i, /\bagency\b|\bagencies\b/i, /\bpipeline\b/i,
        /\binbox\b/i, /\blinkedin\b/i, /\bdeals?\b/i, /\bsdrs?\b|\baes?\b(?= )/i),
    ],
  },
  {
    slug: 'marketing-growth',
    name: 'Marketing & Growth',
    color: '#22c55e',
    description: 'Marketing, ads, copywriting, brand building, funnels, SEO, audience growth',
    rules: [
      ...w(3, /marketing/i, /\badvertis/i, /\bfacebook ads|meta ads|google ads|paid (social|ads)\b/i,
        /copywrit/i, /media buying/i, /\bseo\b/i, /newsletter/i, /conversion rate/i, /\bfunnels?\b/i,
        /personal brand/i, /\bgo[- ]to[- ]market\b|\bgtm\b/i, /\bugc\b/i, /\becom\b|e-?commerce|\bdtc\b/i),
      ...w(2, /\bads?\b/i, /\bbrands?\b/i, /\bviral\b/i, /\bgrowth\b/i, /\baudience\b/i, /\bengagement\b/i,
        /waitlist/i, /\blaunch(ed|ing)?\b/i, /\bimpressions?\b/i),
    ],
  },
  {
    slug: 'content-creation',
    name: 'Content & Video',
    color: '#ef4444',
    description: 'Video editing, filming, YouTube, short-form content, thumbnails, hooks, storytelling, filmmaking',
    rules: [
      ...w(3, /video edit|edit(ing|ed|or|ors)? (my |your |the |a )?videos?/i, /\bediting\b/i,
        /\bthumbnails?\b|\bthumbys?\b/i, /\byoutube\b|\byt\b|\bchannels?\b/i, /short[- ]form/i,
        /\breels?\b|\btiktok\b/i, /\bhooks?\b/i, /cinematic|cinematograph|filmmak|b-?roll|color grad/i,
        /davinci|resolve|premiere|after effects|capcut|final cut|descript|\bblender\b/i,
        /\bcontent (creat|strateg)|pieces of content|faceless content|\bcreators?\b/i,
        /storytell|\bscripts?\b|\btitles?\b|retention|watch time/i, /\bmotion (design|graphics)\b|animation/i),
      ...w(2, /\bcontent\b/i, /\bvideos?\b/i, /\bfilm(ed|ing)?\b/i, /\bclips?\b|clipper/i, /\bcamera\b|lighting/i,
        /\bposting\b|\bpost (more|daily)\b/i, /\bviews\b/i, /\bpodcast/i),
    ],
  },
  {
    slug: 'dev-tools',
    name: 'Dev Tools & Engineering',
    color: '#06b6d4',
    description: 'Software engineering, coding, GitHub, open source, APIs, apps, developer tooling',
    rules: [
      ...w(3, /software engineer/i, /\bdevelopers?\b/i, /programming/i, /\bcoding\b|\bcoder\b/i,
        /github|\brepos?\b/i, /open[- ]?source/i, /\bapis?\b/i, /database/i, /typescript|javascript|python|\brust\b/i,
        /\breact\b|next\.js|node\.js|docker|vercel|supabase|cloudflare/i, /\bcli\b|terminal|\blinux\b/i,
        /testflight|\bios app\b|app store|\bswift\b/i, /\bself[- ]host/i),
      ...w(2, /\bapps?\b/i, /\bbuild(ing)? (an? )?(app|tool|site|product)/i, /\bbrowser\b/i, /\bshipped\b/i,
        /\bplugin\b/i, /\bshortcut\b/i),
    ],
  },
  {
    slug: 'startups-business',
    name: 'Startups & Business',
    color: '#3b82f6',
    description: 'Startups, founders, entrepreneurship, business models, revenue, building companies',
    rules: [
      ...w(3, /startups?/i, /\bfounders?\b/i, /entrepreneur/i, /\bsaas\b/i, /fundrais|venture capital|\bvcs?\b/i,
        /y ?combinator|\byc\b/i, /bootstrap/i, /\bacquisition\b|\bacquired\b/i, /small business/i,
        /\$\d+(\.\d+)?\s?(k|m|mm|million|b)\b(\/mo| a month| per month| arr| mrr| revenue)?/i, /\bmrr\b|\barr\b/i),
      ...w(2, /\bbusiness(es)?\b/i, /revenue/i, /\bcustomers?\b/i, /\bcompany\b/i, /\bprofit/i,
        /\bceo\b/i, /\bmoats?\b/i, /\bmake money|print money\b/i, /\bhire|hiring\b/i),
    ],
  },
  {
    slug: 'dating-relationships',
    name: 'Dating & Relationships',
    color: '#e879f9',
    description: 'Dating, attraction, texting, approaching, relationships, intimacy, social dynamics with women',
    rules: [
      ...w(3, /\bdating\b|\bdates?\b(?! (back|from))/i, /\bgirlfriends?\b|\bboyfriends?\b|\bwife\b|\bhusband\b|\bex\b/i,
        /relationship/i, /\bbreak ?ups?\b/i, /attraction|attractive|seduc|flirt|\brizz\b|charisma/i,
        /shit tests?/i, /hypergamy/i, /\bapproach(es|ing)?\b/i, /\btext(ing)? (her|him|game)\b|text her/i,
        /\bfemale\b|\bwom[ae]n\b|\bgirls?\b/i, /\bturn (her|you) on\b|\bin bed\b|\bkiss/i,
        /\bfuck|\bpussy|\bsex(ual|y)?\b|\bhoes?\b|\bbitch(es)?\b/i, /\bhinge\b|\btinder\b|\bbumble\b/i,
        /\bmarriage\b|\bmarried\b|\bromantic\b|intimacy/i),
      ...w(3, /\b(treat|tell|text|get|make|turn|kiss|ask|call|push|pull|tease|grab) her\b|\bher (insults|words|respond|attention)/i),
      ...w(1, /\bshe\b|\bher\b/i),
    ],
  },
  {
    slug: 'mindset-growth',
    name: 'Mindset & Self-Improvement',
    color: '#eab308',
    description: 'Mindset, discipline, confidence, masculinity, habits, motivation, social skills and life advice',
    rules: [
      ...w(3, /mindset/i, /discipline/i, /\bconfiden(ce|t)\b/i, /self[- ]improvement/i, /masculin|as a man\b|\bmen\b|\bmale\b/i,
        /\bhabits?\b/i, /motivation/i, /\bstoic/i, /\bego\b/i, /\bfear\b/i, /\bsocial skills?\b|\bconversation/i,
        /\blife advice\b/i, /\bpurpose\b|\bagency\b(?! (owner|model))/i, /\bbody language\b/i, /\btate\b/i),
      ...w(2, /\bsucce(ss|ed)\b/i, /\bfriends?\b/i, /\bgrind\b/i, /\bwinners?\b/i, /\bworth\b/i, /\blessons?\b/i, /\brespect\b/i),
      ...w(1, /\bskills?\b/i),
    ],
  },
  {
    slug: 'sports',
    name: 'Sports',
    color: '#14b8a6',
    description: 'Soccer, basketball, tennis, training, players, matches and sports highlights',
    rules: [
      ...w(3, /\bsoccer\b|\bfootball\b|premier league|champions league|ballon d.or|\bfifa\b|world cup/i,
        /\bnba\b|\bnfl\b|\bmvp\b|\bplayoffs?\b|\bdunk/i, /\btennis\b|forehand|backhand/i,
        /\bmessi\b|\bronaldo\b|\byamal\b|\bsaka\b|\bolise\b|\bajax\b|\barsenal\b|\bmadrid\b|\bbarca/i,
        /\btimberwolves\b|\braptors\b|\bspurs\b|\bokc\b|\blakers\b|\bceltics\b|\bwemby\b|harden|lebron|edwards|mitchell|lamelo/i,
        /\bstriker\b|\bgoals?\b|\bjersey\b|\bpro sports\b|\bathletes?\b|\bcoach(ing)?\b/i),
      ...w(2, /\bteam\b/i, /\bseason\b/i, /\bgame\b/i, /\btraining\b|\bdrills?\b|\bsprints?\b/i, /\bplayers?\b/i),
    ],
  },
  {
    slug: 'health-wellness',
    name: 'Health & Wellness',
    color: '#84cc16',
    description: 'Health, fitness, nutrition, sleep, injuries, physical therapy and longevity',
    rules: [
      ...w(3, /\bhealth/i, /fitness|workout|\bgym\b|exercise|\blifting\b/i, /nutrition|protein|\bdiet\b|weight loss/i,
        /longevity|\bsleep\b|supplement|vitamin/i, /\bknee\b|injur|surgery|physio|mobility|posture/i,
        /fluoride|seed oils?|toxins?/i),
      ...w(2, /\bbody\b/i, /\bmuscle\b/i, /\bpain\b/i, /\bdoctor\b|\bmd\b/i),
    ],
  },
  {
    slug: 'beauty-skincare',
    name: 'Beauty & Skincare',
    color: '#fda4af',
    description: 'Skincare, acne, grooming, hair, beauty products and looking good',
    rules: [
      ...w(3, /skin ?care|\bskin\b/i, /\bacne\b|blackheads?|sebaceous|exfoliat|retinol|salicylic/i, /dermatolog/i,
        /cosmetic|makeup|moisturi|sunscreen|\bspf\b/i, /\bhair ?(cut|care|line)?\b|\bbeard\b|grooming/i,
        /fragrance|perfume|cologne/i, /look(ing)? younger|anti[- ]aging|plastic surgeon/i),
    ],
  },
  {
    slug: 'fashion-style',
    name: 'Fashion & Style',
    color: '#f472b6',
    description: 'Fashion, outfits, clothing, shoes, accessories and personal style',
    rules: [
      ...w(3, /fashion/i, /outfits?|\bfit pic\b|\bfits\b/i, /wardrobe|clothing|menswear|womenswear|streetwear/i,
        /\bstyling\b|\bstyle\b/i, /\bshoes?\b|sneakers?|\bjacket\b|\bshirts?\b|\btee\b|\bcollar\b|\bjeans\b/i),
    ],
  },
  {
    slug: 'design',
    name: 'Design & Product',
    color: '#ec4899',
    description: 'UI/UX, product design, typography, fonts, branding visuals, design tools',
    rules: [
      ...w(3, /\bdesign(er|ers|ing)?\b/i, /\bui\b|\bux\b/i, /figma|canva\b|framer|mobbin/i, /typograph|typeface|\bfonts?\b/i,
        /design system|landing page|brand identity|web design|\blogo\b|\bsvgs?\b/i),
      ...w(2, /\bvisual/i, /\baesthetic\b/i, /\bslides\b/i),
    ],
  },
  {
    slug: 'productivity',
    name: 'Productivity',
    color: '#a855f7',
    description: 'Productivity tools, workflows, automation, note-taking, dictation and getting more done',
    rules: [
      ...w(3, /productivity/i, /time management|deep work|\bfocus\b/i, /note[- ]taking|second brain|\bnotion\b|obsidian/i,
        /\bworkflows?\b|automat/i, /daily routine/i, /dictation|voice typing|wispr|meeting notes|granola/i),
      ...w(2, /\btools?\b/i, /\bfree (tool|resource)/i, /\bguide\b/i),
    ],
  },
  {
    slug: 'technology-gadgets',
    name: 'Technology & Gadgets',
    color: '#64748b',
    description: 'Consumer tech, phones, computers, hardware and gaming',
    rules: [
      ...w(3, /gadget|iphone|android|smartphone|macbook|\blaptop\b|\bipad\b/i, /hardware|\bgpu\b|vram|\bchips?\b/i,
        /headphones|wearable|smart home/i, /\bgta\b|video games?|\bgaming\b|\bconsole\b|play (all )?these games/i),
      ...w(2, /\btech(nology)?\b/i, /\bcomputer\b|\bpc\b/i, /\bdevice/i),
    ],
  },
  {
    slug: 'finance-investing',
    name: 'Finance & Investing',
    color: '#10b981',
    description: 'Investing, stocks, markets, real estate, personal finance and money',
    rules: [
      ...w(3, /invest(ing|ment|or)/i, /stock market|\bstocks?\b|equities|portfolio/i, /interest rates?|federal reserve|inflation/i,
        /hedge fund|private equity|real estate|mortgage/i, /personal finance|\bwealth\b|\bretire/i, /\bkalshi\b|polymarket|betting|gambl/i),
    ],
  },
  {
    slug: 'finance-crypto',
    name: 'Crypto & Web3',
    color: '#f59e0b',
    description: 'Crypto, Bitcoin, Ethereum, DeFi, NFTs and Web3',
    rules: [
      ...w(3, /crypto/i, /bitcoin|\bbtc\b/i, /ethereum|\beth\b/i, /solana/i, /blockchain|web3|defi|airdrop|memecoin|\bnfts?\b|on[- ]chain/i),
    ],
  },
  {
    slug: 'science-research',
    name: 'Science & Research',
    color: '#0ea5e9',
    description: 'Science, research papers, physics, biology, psychology studies',
    rules: [
      ...w(3, /scientific|\bscience\b/i, /research paper|\bstudy (shows|found)|\bstudied\b/i, /physics|biology|neuroscience|astronomy|quantum/i,
        /clinical trial|epistemic|cognitive/i),
    ],
  },
  {
    slug: 'news',
    name: 'News & Politics',
    color: '#6b7280',
    description: 'News, politics, elections, government and world events',
    rules: [
      ...w(3, /breaking news/i, /politic/i, /election/i, /president/i, /government|congress|senate/i, /geopolitic|foreign policy/i,
        /\bmayor\b|\bpolice\b|\bflood/i),
    ],
  },
  {
    slug: 'security-privacy',
    name: 'Security & Privacy',
    color: '#dc2626',
    description: 'Cybersecurity, hacking, privacy, encryption',
    rules: [
      ...w(3, /cybersecurity/i, /\bhack(ing|ers?)?\b/i, /exploit|vulnerabilit|malware|phishing|data breach/i, /\bprivacy\b|encryption|\bvpn\b/i),
    ],
  },
  {
    slug: 'funny-memes',
    name: 'Funny & Entertainment',
    color: '#facc15',
    description: 'Memes, jokes, funny clips, movies, streamers, music and pop culture',
    rules: [
      ...w(3, /\bmemes?\b|\bfunny\b|\bjoke\b|\blm?fa+o+\b|\blmao+\b|\blol\b|shitpost|parody|satire|😂|🤣|😭/i,
        /\bmovies?\b|\bcinemas?\b|thrillers?|\banime\b|\bstreamers?\b|\bbruh+\b/i),
      ...w(2, /\bfilms?\b(?!mak)|\bnetflix\b|\bmusic\b|\bsongs?\b|streaming/i),
      ...w(1, /\bbro\b|\bwild\b|\binsane\b/i),
    ],
  },
]

export const GENERAL_CATEGORY = {
  slug: 'general',
  name: 'General',
  color: '#71717a',
  description: 'Everything that does not clearly fit another category',
}

const MIN_SCORE = 2

function scoreCategory(text: string, rules: Array<[RegExp, number]>): number {
  let total = 0
  for (const [pattern, weight] of rules) {
    if (pattern.test(text)) total += weight
  }
  return total
}

export function classifyBookmark(text: string): CategoryMatch[] {
  const ranked = CATEGORY_DEFINITIONS
    .map((definition) => ({ slug: definition.slug, score: scoreCategory(text, definition.rules) }))
    .filter((item) => item.score >= MIN_SCORE)
    .sort((left, right) => right.score - left.score)

  if (ranked.length === 0) return [{ slug: 'general', confidence: 0.55 }]

  const strongest = ranked[0].score
  return ranked
    .filter((item, index) => index === 0 || item.score >= Math.max(3, strongest * 0.6))
    .slice(0, 3)
    .map((item) => ({
      slug: item.slug,
      confidence: Math.round(Math.min(0.95, 0.55 + item.score * 0.06) * 100) / 100,
    }))
}

/** Build the text the classifier sees: tweet text, author, and link/quote context from the raw payload. */
export function classificationTextFor(input: {
  text: string
  authorName?: string | null
  authorHandle?: string | null
  rawJson?: string | null
}): string {
  const parts = [input.text, input.authorName ?? '', input.authorHandle ?? '']
  if (input.rawJson) {
    try {
      const raw = JSON.parse(input.rawJson) as Record<string, unknown>
      const legacy = (raw.legacy ?? {}) as { entities?: { urls?: Array<{ expanded_url?: string }> } }
      for (const url of legacy.entities?.urls ?? []) {
        if (url.expanded_url) parts.push(url.expanded_url.replace(/[/._-]+/g, ' '))
      }
      const quoted = (raw.quoted_status_result as { result?: { legacy?: { full_text?: string } } } | undefined)
        ?.result?.legacy?.full_text
      if (quoted) parts.push(quoted)
      const article = (raw.article as { article_results?: { result?: { title?: string } } } | undefined)
        ?.article_results?.result?.title
      if (article) parts.push(article)
    } catch {
      // Malformed raw payloads just fall back to the visible text.
    }
  }
  return parts.join('\n')
}
