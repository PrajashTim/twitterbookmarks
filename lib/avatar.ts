/** Pull the author's profile photo out of a stored X GraphQL tweet payload. */
export function avatarFromRaw(rawJson?: string): string | null {
  if (!rawJson) return null
  try {
    const raw = JSON.parse(rawJson) as {
      core?: { user_results?: { result?: { avatar?: { image_url?: string }; legacy?: { profile_image_url_https?: string } } } }
    }
    const user = raw.core?.user_results?.result
    const url = user?.avatar?.image_url ?? user?.legacy?.profile_image_url_https
    return url ? url.replace('_normal.', '_bigger.') : null
  } catch {
    return null
  }
}
