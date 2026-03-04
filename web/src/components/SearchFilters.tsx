/**
 * SearchFilters Preact Island — Sidebar Layout
 *
 * Vertical filter controls designed for the sidebar panel.
 * Text search triggers on form submit; selects navigate immediately.
 */

import { useState, useCallback } from 'preact/hooks';

interface CategoryOption {
  slug: string;
  label: string;
}

interface LocaleOption {
  locale: string;
  flag: string;
  label: string;
  count: number;
}

interface SearchFiltersProps {
  initialQuery: string;
  initialSort: string;
  initialSortDir: string;
  initialGamemode: string;
  initialLocale: string;
  initialMinPlayers: string;
  initialMaxPlayers: string;
  categories: CategoryOption[];
  locales: LocaleOption[];
}

interface SortOption {
  label: string;
  sort: string;
  sortDir: string;
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'Most Players', sort: 'players', sortDir: 'desc' },
  { label: 'Fewest Players', sort: 'players', sortDir: 'asc' },
  { label: 'Name A–Z', sort: 'name', sortDir: 'asc' },
  { label: 'Name Z–A', sort: 'name', sortDir: 'desc' },
];

/**
 * Builds a query string from filter state, omitting defaults.
 */
function buildParams(state: {
  query: string;
  gamemode: string;
  locale: string;
  minPlayers: string;
  maxPlayers: string;
  sortKey: string;
}): string {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set('q', state.query.trim());
  if (state.gamemode) params.set('category', state.gamemode);
  if (state.locale) params.set('locale', state.locale);
  if (state.minPlayers) params.set('minPlayers', state.minPlayers);
  if (state.maxPlayers) params.set('maxPlayers', state.maxPlayers);

  const [sort, sortDir] = state.sortKey.split('_');
  if (sort && sort !== 'players') params.set('sort', sort);
  if (sortDir && sortDir !== 'desc') params.set('sortDir', sortDir);

  return params.toString();
}

export default function SearchFilters(props: SearchFiltersProps) {
  const [query, setQuery] = useState(props.initialQuery);
  const [gamemode, setGamemode] = useState(props.initialGamemode);
  const [locale, setLocale] = useState(props.initialLocale);
  const [minPlayers, setMinPlayers] = useState(props.initialMinPlayers);
  const [maxPlayers, setMaxPlayers] = useState(props.initialMaxPlayers);
  const initialSortKey = `${props.initialSort || 'players'}_${props.initialSortDir || 'desc'}`;
  const [sortKey, setSortKey] = useState(initialSortKey);

  const navigate = useCallback(
    (overrides: Record<string, string> = {}) => {
      const state = { query, gamemode, locale, minPlayers, maxPlayers, sortKey, ...overrides };
      const qs = buildParams(state);
      window.location.href = qs ? `/?${qs}` : '/';
    },
    [query, gamemode, locale, minPlayers, maxPlayers, sortKey],
  );

  const handleSubmit = useCallback(
    (e: Event) => {
      e.preventDefault();
      navigate();
    },
    [navigate],
  );

  const handleGamemodeChange = useCallback(
    (e: Event) => {
      const val = (e.target as HTMLSelectElement).value;
      setGamemode(val);
      navigate({ gamemode: val });
    },
    [navigate],
  );

  const handleLocaleChange = useCallback(
    (e: Event) => {
      const val = (e.target as HTMLSelectElement).value;
      setLocale(val);
      navigate({ locale: val });
    },
    [navigate],
  );

  const handleSortChange = useCallback(
    (e: Event) => {
      const val = (e.target as HTMLSelectElement).value;
      setSortKey(val);
      navigate({ sortKey: val });
    },
    [navigate],
  );

  const labelCls =
    'block text-[11px] font-semibold uppercase tracking-widest text-txt-3 mb-1.5';

  const inputCls =
    'w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm text-txt placeholder-txt-3 outline-none transition-all duration-200 focus:border-accent/50 focus:ring-2 focus:ring-accent/15';

  const selectCls =
    'w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm text-txt outline-none transition-all duration-200 focus:border-accent/50 focus:ring-2 focus:ring-accent/15 appearance-none cursor-pointer';

  return (
    <form onSubmit={handleSubmit} class="space-y-4">
      {/* Search */}
      <div>
        <label class={labelCls}>Search</label>
        <div class="relative">
          <svg
            class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-txt-3 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            placeholder="Server name..."
            class={`${inputCls} pl-9`}
            aria-label="Search servers"
          />
        </div>
      </div>

      <div class="h-px bg-edge/50" />

      {/* Category */}
      <div>
        <label class={labelCls}>Category</label>
        <select
          value={gamemode}
          onChange={handleGamemodeChange}
          class={selectCls}
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {props.categories.map((cat) => (
            <option key={cat.slug} value={cat.slug}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {/* Region */}
      <div>
        <label class={labelCls}>Region</label>
        <select
          value={locale}
          onChange={handleLocaleChange}
          class={selectCls}
          aria-label="Filter by region"
        >
          <option value="">All Regions</option>
          {props.locales.map((loc) => (
            <option key={loc.locale} value={loc.locale}>
              {loc.flag} {loc.label} ({loc.count.toLocaleString()})
            </option>
          ))}
        </select>
      </div>

      {/* Sort */}
      <div>
        <label class={labelCls}>Sort by</label>
        <select
          value={sortKey}
          onChange={handleSortChange}
          class={selectCls}
          aria-label="Sort servers"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={`${opt.sort}_${opt.sortDir}`} value={`${opt.sort}_${opt.sortDir}`}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div class="h-px bg-edge/50" />

      {/* Player count range */}
      <div>
        <label class={labelCls}>Players</label>
        <div class="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={minPlayers}
            onInput={(e) => setMinPlayers((e.target as HTMLInputElement).value)}
            placeholder="Min"
            min="0"
            class={inputCls}
            aria-label="Minimum player count"
          />
          <input
            type="number"
            value={maxPlayers}
            onInput={(e) => setMaxPlayers((e.target as HTMLInputElement).value)}
            placeholder="Max"
            min="0"
            class={inputCls}
            aria-label="Maximum player count"
          />
        </div>
      </div>

      {/* Apply */}
      <button
        type="submit"
        class="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-surface-0 transition-all duration-200 hover:bg-accent-hover hover:shadow-[0_4px_16px_-4px] hover:shadow-accent/30 active:scale-[0.98]"
      >
        Apply Filters
      </button>
    </form>
  );
}
