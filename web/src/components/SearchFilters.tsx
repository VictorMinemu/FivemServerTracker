/**
 * SearchFilters Preact Island
 *
 * Interactive client-side component for searching, filtering, and sorting
 * the server listing. Renders as a form that navigates via URL query params
 * on submit, making all filter state bookmarkable and shareable.
 *
 * @module
 */

import { useState, useCallback, useRef } from 'preact/hooks';

/** Category option for the gamemode dropdown */
interface CategoryOption {
  slug: string;
  label: string;
}

/** Props for the SearchFilters component */
interface SearchFiltersProps {
  initialQuery: string;
  initialSort: string;
  initialSortDir: string;
  initialGamemode: string;
  initialLocale: string;
  initialMinPlayers: string;
  initialMaxPlayers: string;
  categories: CategoryOption[];
}

/** Sort option definition for the sort dropdown */
interface SortOption {
  label: string;
  sort: string;
  sortDir: string;
}

const SORT_OPTIONS: SortOption[] = [
  { label: 'Most Players', sort: 'players', sortDir: 'desc' },
  { label: 'Fewest Players', sort: 'players', sortDir: 'asc' },
  { label: 'Name A-Z', sort: 'name', sortDir: 'asc' },
  { label: 'Name Z-A', sort: 'name', sortDir: 'desc' },
];

/**
 * SearchFilters component for server listing page.
 *
 * Renders search input, category/gamemode dropdown, sort dropdown,
 * and min/max player count inputs. On form submit, navigates to
 * the listing page with appropriate URL query parameters.
 *
 * @param props - Initial filter values and category list
 * @returns Preact VNode
 *
 * @example
 * ```tsx
 * <SearchFilters
 *   client:load
 *   initialQuery=""
 *   initialSort="players"
 *   initialSortDir="desc"
 *   initialGamemode=""
 *   initialLocale=""
 *   initialMinPlayers=""
 *   initialMaxPlayers=""
 *   categories={[{ slug: 'rp', label: 'Roleplay' }]}
 * />
 * ```
 */
export default function SearchFilters(props: SearchFiltersProps) {
  const [query, setQuery] = useState(props.initialQuery);
  const [gamemode, setGamemode] = useState(props.initialGamemode);
  const [locale] = useState(props.initialLocale);
  const [minPlayers, setMinPlayers] = useState(props.initialMinPlayers);
  const [maxPlayers, setMaxPlayers] = useState(props.initialMaxPlayers);

  // Combine sort + sortDir into a single select value
  const initialSortKey = `${props.initialSort || 'players'}_${props.initialSortDir || 'desc'}`;
  const [sortKey, setSortKey] = useState(initialSortKey);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Builds URLSearchParams from non-empty filter values and navigates.
   */
  const navigateWithFilters = useCallback(() => {
    const params = new URLSearchParams();

    if (query.trim()) params.set('q', query.trim());
    if (gamemode) params.set('category', gamemode);
    if (locale) params.set('locale', locale);
    if (minPlayers) params.set('minPlayers', minPlayers);
    if (maxPlayers) params.set('maxPlayers', maxPlayers);

    // Parse sort key back to sort + sortDir
    const [sort, sortDir] = sortKey.split('_');
    if (sort && sort !== 'players') params.set('sort', sort);
    if (sortDir && sortDir !== 'desc') params.set('sortDir', sortDir);
    // Default is players_desc, no need to include in URL

    const qs = params.toString();
    window.location.href = qs ? `/?${qs}` : '/';
  }, [query, gamemode, locale, minPlayers, maxPlayers, sortKey]);

  /**
   * Handles form submission (primary interaction).
   */
  const handleSubmit = useCallback(
    (e: Event) => {
      e.preventDefault();
      navigateWithFilters();
    },
    [navigateWithFilters],
  );

  /**
   * Debounced search on text input (enhancement).
   */
  const handleQueryInput = useCallback(
    (e: Event) => {
      const value = (e.target as HTMLInputElement).value;
      setQuery(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams();
        if (value.trim()) params.set('q', value.trim());

        // Preserve other active filters
        if (gamemode) params.set('category', gamemode);
        if (locale) params.set('locale', locale);
        if (minPlayers) params.set('minPlayers', minPlayers);
        if (maxPlayers) params.set('maxPlayers', maxPlayers);
        const [sort, sortDir] = sortKey.split('_');
        if (sort && sort !== 'players') params.set('sort', sort);
        if (sortDir && sortDir !== 'desc') params.set('sortDir', sortDir);

        const qs = params.toString();
        window.location.href = qs ? `/?${qs}` : '/';
      }, 300);
    },
    [gamemode, locale, minPlayers, maxPlayers, sortKey],
  );

  const inputClass =
    'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-400';

  const selectClass =
    'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400';

  return (
    <form onSubmit={handleSubmit} class="mb-6 space-y-4">
      {/* Search input - full width */}
      <div>
        <input
          type="text"
          value={query}
          onInput={handleQueryInput}
          placeholder="Search servers..."
          class={inputClass}
          aria-label="Search servers by name"
        />
      </div>

      {/* Filter row - stacks on mobile, row on desktop */}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* Category/Gamemode dropdown */}
        <select
          value={gamemode}
          onChange={(e) => setGamemode((e.target as HTMLSelectElement).value)}
          class={selectClass}
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {props.categories.map((cat) => (
            <option key={cat.slug} value={cat.slug}>
              {cat.label}
            </option>
          ))}
        </select>

        {/* Sort dropdown */}
        <select
          value={sortKey}
          onChange={(e) => setSortKey((e.target as HTMLSelectElement).value)}
          class={selectClass}
          aria-label="Sort servers"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={`${opt.sort}_${opt.sortDir}`} value={`${opt.sort}_${opt.sortDir}`}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Min players */}
        <input
          type="number"
          value={minPlayers}
          onInput={(e) => setMinPlayers((e.target as HTMLInputElement).value)}
          placeholder="Min players"
          min="0"
          class={inputClass}
          aria-label="Minimum player count"
        />

        {/* Max players */}
        <input
          type="number"
          value={maxPlayers}
          onInput={(e) => setMaxPlayers((e.target as HTMLInputElement).value)}
          placeholder="Max players"
          min="0"
          class={inputClass}
          aria-label="Maximum player count"
        />

        {/* Submit button */}
        <button
          type="submit"
          class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-offset-gray-900"
        >
          Search
        </button>
      </div>
    </form>
  );
}
