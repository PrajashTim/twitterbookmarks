const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'
const QUERY_ID = 'xLjCVTqYWz8CGSprLU349w'
const FEATURES = {
  graphql_timeline_v2_bookmark_timeline: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_enhance_cards_enabled: false,
}

function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

function parsePage(data) {
  const instructions = data?.data?.bookmark_timeline_v2?.timeline?.instructions ?? []
  const tweets = []
  let nextCursor = null

  for (const instruction of instructions) {
    if (instruction.type !== 'TimelineAddEntries') continue
    for (const entry of instruction.entries ?? []) {
      const content = entry.content
      if (content?.entryType === 'TimelineTimelineItem') {
        let tweet = content?.itemContent?.tweet_results?.result
        if (tweet?.__typename === 'TweetWithVisibilityResults' && tweet.tweet) tweet = tweet.tweet
        if (tweet?.rest_id) tweets.push(tweet)
      } else if (content?.entryType === 'TimelineTimelineCursor' && content?.cursorType === 'Bottom') {
        nextCursor = content.value ?? null
      }
    }
  }

  return { tweets, nextCursor }
}

async function fetchPage(cursor) {
  const ct0 = csrfToken()
  if (!ct0) throw new Error('Sign into X in this Chrome profile before syncing')

  const variables = JSON.stringify({
    count: 100,
    includePromotedContent: false,
    ...(cursor ? { cursor } : {}),
  })
  const url = `https://x.com/i/api/graphql/${QUERY_ID}/Bookmarks?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(JSON.stringify(FEATURES))}`
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${BEARER}`,
      'X-Csrf-Token': ct0,
      'X-Twitter-Auth-Type': 'OAuth2Session',
      'X-Twitter-Active-User': 'yes',
      'X-Twitter-Client-Language': 'en',
      Accept: '*/*',
    },
  })

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('X sign-in expired; open x.com and sign in again')
    }
    throw new Error(`X bookmark request failed (${response.status}); the extension may need an update`)
  }
  return parsePage(await response.json())
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'SIFTLY_FETCH_PAGE') return false
  fetchPage(message.cursor)
    .then((page) => sendResponse({ ok: true, ...page }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  return true
})
