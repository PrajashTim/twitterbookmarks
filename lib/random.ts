export function pickRandomOffset(total: number, random = Math.random): number {
  if (!Number.isFinite(total) || total <= 1) return 0

  const normalized = Math.min(Math.max(random(), 0), 1 - Number.EPSILON)
  return Math.floor(normalized * Math.floor(total))
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function orderIdsBySeed(ids: string[], seed: string): string[] {
  return [...ids].sort((left, right) => {
    const difference = hashString(`${seed}:${left}`) - hashString(`${seed}:${right}`)
    return difference || left.localeCompare(right)
  })
}
