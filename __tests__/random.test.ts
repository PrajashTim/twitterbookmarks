import { describe, expect, it } from 'vitest'
import { orderIdsBySeed, pickRandomOffset } from '@/lib/random'

describe('pickRandomOffset', () => {
  it('returns zero for empty and single-item sets', () => {
    expect(pickRandomOffset(0, () => 0.9)).toBe(0)
    expect(pickRandomOffset(1, () => 0.9)).toBe(0)
  })

  it('maps the random value across every valid database offset', () => {
    expect(pickRandomOffset(10, () => 0)).toBe(0)
    expect(pickRandomOffset(10, () => 0.5)).toBe(5)
    expect(pickRandomOffset(10, () => 0.999999)).toBe(9)
  })

  it('guards against out-of-range random providers', () => {
    expect(pickRandomOffset(10, () => -1)).toBe(0)
    expect(pickRandomOffset(10, () => 2)).toBe(9)
  })
})

describe('orderIdsBySeed', () => {
  const ids = Array.from({ length: 20 }, (_, index) => `bookmark-${index}`)

  it('returns a stable permutation for the same seed', () => {
    const first = orderIdsBySeed(ids, 'session-one')
    const second = orderIdsBySeed(ids, 'session-one')

    expect(second).toEqual(first)
    expect([...first].sort()).toEqual([...ids].sort())
  })

  it('changes the order when the seed changes', () => {
    expect(orderIdsBySeed(ids, 'session-one')).not.toEqual(orderIdsBySeed(ids, 'session-two'))
  })
})
