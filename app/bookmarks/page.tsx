'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Search,
  BookmarkX,
  LayoutGrid,
  List,
  AlignJustify,
  X,
  ChevronDown,
  ArrowUpDown,
  Shuffle,
  Dices,
  Sparkles,
} from 'lucide-react'
import * as Select from '@radix-ui/react-select'
import BookmarkCard from '@/components/bookmark-card'
import BookmarkRow from '@/components/bookmark-row'
import BookmarkDetailModal from '@/components/bookmark-detail-modal'
import type { BookmarkWithMedia, BookmarksResponse, Category } from '@/lib/types'

const DEFAULT_PAGE_SIZE = 24
const COMPACT_PAGE_SIZE = 100

interface Filters {
  q: string
  category: string
  mediaType: string
  source: string
  sort: string
  uncategorized: boolean
  randomSeed: string
}

const DEFAULT_FILTERS: Filters = {
  q: '',
  category: '',
  mediaType: '',
  source: '',
  sort: 'best',
  uncategorized: false,
  randomSeed: '',
}

/** "best" = relevance while searching, newest otherwise. */
function apiSort(filters: Filters): string {
  if (filters.sort === 'best') return filters.q ? 'relevance' : 'newest'
  return filters.sort
}

function useColumnCount(ref: React.RefObject<HTMLDivElement | null>): number {
  const [count, setCount] = useState(1)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      setCount(w >= 1300 ? 4 : w >= 940 ? 3 : w >= 560 ? 2 : 1)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return count
}

function Masonry({ items, highlight }: { items: BookmarkWithMedia[]; highlight: string[] }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const columnCount = useColumnCount(ref)
  const columns: BookmarkWithMedia[][] = Array.from({ length: columnCount }, () => [])
  items.forEach((item, index) => columns[index % columnCount].push(item))
  return (
    <div ref={ref} className="masonry-columns">
      {columns.map((column, i) => (
        <div key={i} className="masonry-column">
          {column.map((bookmark) => (
            <div key={bookmark.id} className="masonry-item">
              <BookmarkCard bookmark={bookmark} highlight={highlight} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function CategoryChips({
  categories,
  active,
  onSelect,
}: {
  categories: Category[]
  active: string
  onSelect: (slug: string) => void
}) {
  if (categories.length === 0) return null
  const visible = categories.filter((c) => c.bookmarkCount > 0)
  return (
    <div className="relative -mx-3 sm:mx-0 mt-3">
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto px-3 sm:px-0 pb-0.5">
        <button
          onClick={() => onSelect('')}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all border ${
            active === ''
              ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
          }`}
        >
          All
        </button>
        {visible.map((cat) => {
          const isActive = active === cat.slug
          return (
            <button
              key={cat.slug}
              onClick={() => onSelect(isActive ? '' : cat.slug)}
              className={`group shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border ${
                isActive ? 'text-zinc-950' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-100 hover:border-zinc-700'
              }`}
              style={isActive ? { backgroundColor: cat.color, borderColor: cat.color } : undefined}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: isActive ? 'rgba(0,0,0,0.55)' : cat.color }}
              />
              {cat.name}
              <span className={`tabular-nums ${isActive ? 'text-zinc-950/60' : 'text-zinc-600 group-hover:text-zinc-500'}`}>
                {cat.bookmarkCount}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function buildUrl(filters: Filters, limit: number, page = 1, random = false): string {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.uncategorized) {
    params.set('uncategorized', 'true')
  } else if (filters.category) {
    params.set('category', filters.category)
  }
  if (filters.mediaType) params.set('mediaType', filters.mediaType)
  if (filters.source) params.set('source', filters.source)
  params.set('sort', apiSort(filters))
  params.set('page', String(page))
  params.set('limit', String(limit))
  if (filters.sort === 'random' && filters.randomSeed) params.set('seed', filters.randomSeed)
  if (random) params.set('random', 'true')
  return `/api/bookmarks?${params.toString()}`
}

function SelectMenu({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: { label: string; value: string }[]
  placeholder: string
}) {
  return (
    <Select.Root value={value || '_all'} onValueChange={(v) => onChange(v === '_all' ? '' : v)}>
      <Select.Trigger className="flex min-h-10 items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 focus:outline-none focus:border-indigo-500 transition-all min-w-[112px] sm:min-w-[120px] shrink-0">
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="ml-auto">
          <ChevronDown size={12} className="text-zinc-600" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
          <Select.Viewport className="p-1">
            <Select.Item
              value="_all"
              className="flex items-center px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 rounded-lg cursor-pointer outline-none transition-colors data-[highlighted]:bg-zinc-800 data-[highlighted]:text-zinc-100"
            >
              <Select.ItemText>{placeholder}</Select.ItemText>
            </Select.Item>
            {options.map((opt) => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                className="flex items-center px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 rounded-lg cursor-pointer outline-none transition-colors data-[highlighted]:bg-zinc-800 data-[highlighted]:text-zinc-100"
              >
                <Select.ItemText>{opt.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

function SkeletonCard() {
  return (
    <div className="masonry-item">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden animate-pulse">
        <div className="h-40 bg-zinc-800" />
        <div className="p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-zinc-800" />
            <div className="space-y-1.5">
              <div className="w-24 h-3 rounded-lg bg-zinc-800" />
              <div className="w-16 h-2.5 rounded-lg bg-zinc-800" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="w-full h-3 rounded-lg bg-zinc-800" />
            <div className="w-5/6 h-3 rounded-lg bg-zinc-800" />
            <div className="w-3/4 h-3 rounded-lg bg-zinc-800" />
          </div>
          <div className="mt-4 pt-3 border-t border-zinc-800 flex gap-2">
            <div className="w-16 h-5 rounded-full bg-zinc-800" />
            <div className="w-20 h-5 rounded-full bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  )
}

function BookmarksPageInner() {
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    uncategorized: searchParams.get('uncategorized') === 'true',
    category: searchParams.get('category') ?? '',
    mediaType: searchParams.get('mediaType') ?? '',
    q: searchParams.get('q') ?? '',
  }))
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') ?? '')
  const [categories, setCategories] = useState<Category[]>([])
  const [matchMode, setMatchMode] = useState<'all' | 'any'>('all')
  const [highlight, setHighlight] = useState<string[]>([])
  const [bookmarks, setBookmarks] = useState<BookmarkWithMedia[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)
  const [loadedPage, setLoadedPage] = useState(0)
  const [randomLoading, setRandomLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('grid')
  const [openBookmark, setOpenBookmark] = useState<BookmarkWithMedia | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const loadMoreControllerRef = useRef<AbortController | null>(null)

  const pageSize = viewMode === 'compact' ? COMPACT_PAGE_SIZE : DEFAULT_PAGE_SIZE

  useEffect(() => {
    const controller = new AbortController()
    loadMoreControllerRef.current?.abort()
    setLoading(true)
    setLoadingMore(false)
    setLoadMoreError(false)
    setBookmarks([])
    setTotal(0)
    setLoadedPage(0)

    async function fetchFirstPage() {
      try {
        const res = await fetch(buildUrl(filters, pageSize), { signal: controller.signal })
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json() as BookmarksResponse
        setBookmarks(data.bookmarks)
        setTotal(data.total)
        setLoadedPage(1)
        setMatchMode(data.matchMode ?? 'all')
        setHighlight(data.highlight ?? [])
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.error(err)
        setBookmarks([])
        setTotal(0)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    fetchFirstPage()
    return () => controller.abort()
  }, [filters, pageSize])

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json() as Promise<{ categories?: Category[] }>)
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => {})
  }, [])

  // Keep the URL in sync so searches and filters can be bookmarked / shared.
  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.q) params.set('q', filters.q)
    if (filters.category) params.set('category', filters.category)
    if (filters.uncategorized) params.set('uncategorized', 'true')
    if (filters.mediaType) params.set('mediaType', filters.mediaType)
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `/bookmarks?${qs}` : '/bookmarks')
  }, [filters.q, filters.category, filters.uncategorized, filters.mediaType])

  const hasMore = bookmarks.length < total

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore || loadedPage < 1 || loadMoreControllerRef.current) return

    const controller = new AbortController()
    loadMoreControllerRef.current = controller
    const nextPage = loadedPage + 1
    setLoadingMore(true)
    setLoadMoreError(false)

    try {
      const res = await fetch(buildUrl(filters, pageSize, nextPage), { signal: controller.signal })
      if (!res.ok) throw new Error('Failed to fetch more bookmarks')
      const data = await res.json() as BookmarksResponse
      setBookmarks((current) => {
        const existingIds = new Set(current.map((bookmark) => bookmark.id))
        return [...current, ...data.bookmarks.filter((bookmark) => !existingIds.has(bookmark.id))]
      })
      setTotal(data.total)
      setLoadedPage(nextPage)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error(err)
      setLoadMoreError(true)
    } finally {
      if (loadMoreControllerRef.current === controller) {
        setLoadingMore(false)
        loadMoreControllerRef.current = null
      }
    }
  }, [filters, hasMore, loadedPage, loading, loadingMore, pageSize])

  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadMoreError) loadMore()
      },
      { rootMargin: '800px 0px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadMore, loadMoreError])

  useEffect(() => () => {
    if (searchRef.current) clearTimeout(searchRef.current)
    loadMoreControllerRef.current?.abort()
  }, [])

  function handleSetViewMode(mode: 'grid' | 'list' | 'compact') {
    setViewMode(mode)
  }

  function updateSearch(q: string) {
    setSearchInput(q)
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, q }))
    }, 300)
  }

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function clearAllFilters() {
    setSearchInput('')
    setFilters(DEFAULT_FILTERS)
  }

  function shuffleOrder() {
    setFilters((prev) => ({
      ...prev,
      sort: 'random',
      randomSeed: crypto.randomUUID(),
    }))
  }

  async function showRandomBookmark() {
    setRandomLoading(true)
    try {
      const res = await fetch(buildUrl(filters, 1, 1, true))
      if (!res.ok) throw new Error('Failed to pick a bookmark')
      const data = await res.json() as BookmarksResponse
      setOpenBookmark(data.bookmarks[0] ?? null)
    } catch (err) {
      console.error(err)
    } finally {
      setRandomLoading(false)
    }
  }

  const mediaOptions = [
    { label: 'Photos', value: 'photo' },
    { label: 'Videos', value: 'video' },
  ]

  const sourceOptions = [
    { label: 'Bookmarks', value: 'bookmark' },
    { label: 'Likes', value: 'like' },
  ]

  const sortOptions = [
    { label: filters.q ? 'Best match' : 'Newest first', value: 'best' },
    { label: 'Newest first', value: 'newest' },
    { label: 'Oldest first', value: 'oldest' },
    { label: 'Shuffled', value: 'random' },
  ]

  const hasActiveFilters = !!(filters.q || filters.category || filters.mediaType || filters.source || (filters.sort !== 'best' && filters.sort !== 'random') || filters.uncategorized)

  const sortLabel = sortOptions.find((o) => o.value === filters.sort)?.label ?? 'Newest first'
  const activeCategory = categories.find((c) => c.slug === filters.category)

  return (
    <div className="flex flex-col h-full">

      {/* ── Sticky top bar ── */}
      <div className="md:sticky md:top-0 z-20 bg-zinc-950/90 backdrop-blur-lg border-b border-zinc-800/60">
        <div className="px-3 sm:px-6 md:px-8 py-3 sm:py-4">
          <div className="flex flex-col xl:flex-row xl:items-center gap-2 xl:gap-3">

            {/* Search */}
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="search"
                placeholder='Search words, @author, or "exact phrase"'
                value={searchInput}
                onChange={(e) => updateSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (searchRef.current) clearTimeout(searchRef.current)
                    setFilters((prev) => ({ ...prev, q: searchInput }))
                  }
                }}
                className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder:text-zinc-500 text-sm focus:outline-none focus:border-indigo-500/70 focus:ring-4 focus:ring-indigo-500/10 transition-all [&::-webkit-search-cancel-button]:hidden"
              />
              {searchInput && (
                <button
                  onClick={() => updateSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            {/* Filters */}
            <SelectMenu
              value={filters.mediaType}
              onChange={(v) => updateFilter('mediaType', v)}
              options={mediaOptions}
              placeholder="All media"
            />

            {/* Source */}
            <SelectMenu
              value={filters.source}
              onChange={(v) => updateFilter('source', v)}
              options={sourceOptions}
              placeholder="All sources"
            />

            {/* Sort */}
            <button
              onClick={() => setFilters((prev) => {
                const cycle = prev.q ? ['best', 'newest', 'oldest'] : ['best', 'oldest']
                const next = cycle[(cycle.indexOf(prev.sort) + 1) % cycle.length] ?? 'best'
                return { ...prev, sort: next, randomSeed: '' }
              })}
              className="flex min-h-10 items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-all shrink-0"
              title={`Sort: ${sortLabel}`}
            >
              <ArrowUpDown size={13} />
              <span className="hidden sm:inline">{sortLabel}</span>
            </button>

            <button
              onClick={shuffleOrder}
              disabled={loading || total === 0}
              className={`flex min-h-10 items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0 ${
                filters.sort === 'random'
                  ? 'bg-cyan-400 border-cyan-300 text-zinc-950'
                  : 'bg-zinc-900 border-zinc-800 text-cyan-300 hover:border-cyan-500/50'
              }`}
              title="Shuffle the bookmark order until you refresh"
            >
              <Dices size={13} />
              <span>Random</span>
            </button>

            <button
              onClick={showRandomBookmark}
              disabled={loading || total === 0 || randomLoading}
              className="flex min-h-10 items-center gap-2 px-3 py-2 rounded-xl bg-amber-400 text-zinc-950 text-sm font-semibold hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0 shadow-[0_0_24px_rgba(251,191,36,0.14)]"
              title="Pick a random bookmark from the current filters"
            >
              <Shuffle size={13} className={randomLoading ? 'animate-spin' : ''} />
              <span className="hidden md:inline">Surprise me</span>
            </button>

            {/* View toggle */}
            <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 rounded-xl p-1 shrink-0">
              <button
                onClick={() => handleSetViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-600 hover:text-zinc-300'
                }`}
                aria-label="Masonry view"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => handleSetViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'list' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-600 hover:text-zinc-300'
                }`}
                aria-label="List view"
              >
                <List size={14} />
              </button>
              <button
                onClick={() => handleSetViewMode('compact')}
                className={`hidden sm:block p-1.5 rounded-lg transition-all ${
                  viewMode === 'compact' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-600 hover:text-zinc-300'
                }`}
                aria-label="Compact view"
              >
                <AlignJustify size={14} />
              </button>
            </div>
            </div>

          </div>

          <CategoryChips
            categories={categories}
            active={filters.uncategorized ? '__none' : filters.category}
            onSelect={(slug) => setFilters((prev) => ({ ...prev, category: slug, uncategorized: false }))}
          />

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {filters.uncategorized && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
                  Uncategorized
                  <button onClick={() => updateFilter('uncategorized', false)} className="text-amber-400 hover:text-amber-200 transition-colors"><X size={10} /></button>
                </span>
              )}
              {filters.category && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
                  {activeCategory?.name ?? filters.category.replace(/-/g, ' ')}
                  <button onClick={() => updateFilter('category', '')} className="text-indigo-400 hover:text-indigo-200 transition-colors"><X size={10} /></button>
                </span>
              )}
              {filters.mediaType && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
                  {mediaOptions.find((o) => o.value === filters.mediaType)?.label}
                  <button onClick={() => updateFilter('mediaType', '')} className="text-indigo-400 hover:text-indigo-200 transition-colors"><X size={10} /></button>
                </span>
              )}
              {filters.source && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
                  {sourceOptions.find((o) => o.value === filters.source)?.label}
                  <button onClick={() => updateFilter('source', '')} className="text-indigo-400 hover:text-indigo-200 transition-colors"><X size={10} /></button>
                </span>
              )}
              {filters.sort !== 'best' && filters.sort !== 'random' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
                  {sortLabel}
                  <button onClick={() => updateFilter('sort', 'best')} className="text-indigo-400 hover:text-indigo-200 transition-colors"><X size={10} /></button>
                </span>
              )}
              <button onClick={clearAllFilters} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors underline underline-offset-2">
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 px-3 sm:px-6 md:px-8 py-4 sm:py-6 max-w-[1600px] mx-auto w-full">

        {/* Results count */}
        {!loading && (
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-zinc-500">
              {total > 0 ? (
                <>
                  <span className="text-zinc-200 font-semibold">{total.toLocaleString()}</span>
                  {' '}bookmark{total !== 1 ? 's' : ''}
                  {filters.q && <span className="text-zinc-500"> for &ldquo;{filters.q}&rdquo;</span>}
                  {activeCategory && <span className="text-zinc-500"> in {activeCategory.name}</span>}
                </>
              ) : (
                'No bookmarks found'
              )}
            </p>
            {filters.q && total > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-zinc-500">
                <Sparkles size={12} className="text-indigo-400" />
                {filters.sort === 'best' ? 'Sorted by best match' : sortLabel}
              </span>
            )}
          </div>
        )}

        {!loading && filters.q && matchMode === 'any' && total > 0 && (
          <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90">
            Nothing matched every word, so these are the closest matches (they contain some of your words).
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="masonry-grid">
            {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && bookmarks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-5">
              <BookmarkX size={26} className="text-zinc-700" />
            </div>
            <h3 className="text-base font-semibold text-zinc-400 mb-2">No bookmarks match your filters</h3>
            <p className="text-zinc-500 text-sm mb-6 max-w-sm">
              Try fewer or different words. Tips: <span className="text-zinc-300">@handle</span> finds an author,
              {' '}<span className="text-zinc-300">&quot;quotes&quot;</span> match an exact phrase,
              {' '}<span className="text-zinc-300">-word</span> excludes a word.
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl transition-colors border border-zinc-800"
              >
                <X size={13} />
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Masonry grid */}
        {!loading && bookmarks.length > 0 && viewMode === 'grid' && (
          <Masonry items={bookmarks} highlight={highlight} />
        )}

        {/* List view */}
        {!loading && bookmarks.length > 0 && viewMode === 'list' && (
          <div className="flex flex-col gap-3 max-w-3xl mx-auto">
            {bookmarks.map((bookmark) => (
              <div key={bookmark.id} className="bookmark-virtual-item">
                <BookmarkCard bookmark={bookmark} highlight={highlight} />
              </div>
            ))}
          </div>
        )}

        {/* Compact view */}
        {!loading && bookmarks.length > 0 && viewMode === 'compact' && (
          <>
            <div className="hidden sm:flex flex-col divide-y divide-zinc-800/50 border border-zinc-800 rounded-2xl overflow-hidden max-w-5xl mx-auto">
              {bookmarks.map((bookmark) => (
                <div key={bookmark.id} className="bookmark-virtual-item">
                  <BookmarkRow bookmark={bookmark} onClick={setOpenBookmark} />
                </div>
              ))}
            </div>
            <div className="sm:hidden masonry-grid">
              {bookmarks.map((bookmark) => (
                <div key={bookmark.id} className="masonry-item">
                  <BookmarkCard bookmark={bookmark} />
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && bookmarks.length > 0 && (
          <div ref={loadMoreRef} className="flex min-h-28 items-center justify-center pt-8" aria-live="polite">
            {hasMore ? (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="group flex min-h-11 items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-5 py-2.5 text-sm text-zinc-400 transition-all hover:border-cyan-500/40 hover:text-zinc-200 disabled:cursor-wait disabled:opacity-70"
              >
                <span className="flex items-center gap-1" aria-hidden="true">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className={`h-1.5 w-1.5 rounded-full bg-cyan-400 ${loadingMore ? 'animate-pulse' : 'group-hover:animate-pulse'}`}
                      style={{ animationDelay: `${dot * 120}ms` }}
                    />
                  ))}
                </span>
                {loadingMore
                  ? 'Loading more bookmarks'
                  : loadMoreError
                    ? 'Could not load more - click to retry'
                    : `Keep scrolling - ${bookmarks.length.toLocaleString()} of ${total.toLocaleString()} loaded`}
              </button>
            ) : (
              <p className="text-sm text-zinc-600">
                All {total.toLocaleString()} bookmarks loaded
              </p>
            )}
          </div>
        )}
      </div>

      {openBookmark && (
        <BookmarkDetailModal
          bookmark={openBookmark}
          onClose={() => setOpenBookmark(null)}
        />
      )}
    </div>
  )
}

export default function BookmarksPage() {
  return (
    <Suspense>
      <BookmarksPageInner />
    </Suspense>
  )
}
