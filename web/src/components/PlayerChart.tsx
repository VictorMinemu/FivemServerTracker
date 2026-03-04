/**
 * PlayerChart Preact Island
 *
 * Interactive client-side component that renders a uPlot time-series chart
 * of server player counts. Supports switching between 24h, 7d, and 30d
 * time ranges, and displays peak and average player statistics.
 *
 * Uses the /api/server/[id]/history.json endpoint to fetch chart data
 * in uPlot's native columnar format [timestamps[], playerCounts[]].
 *
 * @module
 */

import { useRef, useEffect, useState, useCallback } from 'preact/hooks';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

import type { HistoryResponse, TimeRange } from '../lib/history-queries.js';

/** Props for the PlayerChart component */
interface PlayerChartProps {
  /** FiveM server endpoint ID */
  serverId: string;
}

/** Summary statistics for the current range */
interface ChartStats {
  peak: number;
  avg: number;
}

/** Available time range options with labels */
const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

/**
 * PlayerChart component for the server detail page.
 *
 * Fetches player history data from the API and renders an interactive
 * uPlot chart with time range selector buttons and stats display.
 *
 * @param props - Component props with serverId
 * @returns Preact VNode
 *
 * @example
 * ```tsx
 * <PlayerChart client:load serverId="bkr4qr" />
 * ```
 */
export default function PlayerChart({ serverId }: PlayerChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);

  const [range, setRange] = useState<TimeRange>('24h');
  const [stats, setStats] = useState<ChartStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);

  // Fetch data and render chart when serverId or range changes
  useEffect(() => {
    const controller = new AbortController();

    const fetchAndRender = async () => {
      setLoading(true);
      setError(null);
      setIsEmpty(false);

      try {
        const res = await fetch(
          `/api/server/${encodeURIComponent(serverId)}/history.json?range=${range}`,
          { signal: controller.signal },
        );

        if (!res.ok) {
          throw new Error(`API returned ${String(res.status)}`);
        }

        const json = (await res.json()) as HistoryResponse;

        setStats({ peak: json.peak, avg: json.avg });

        // Destroy previous chart instance
        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }

        // Handle empty data
        if (json.data[0].length === 0) {
          setIsEmpty(true);
          setLoading(false);
          return;
        }

        // Create new uPlot instance
        const container = containerRef.current;
        if (!container) {
          setLoading(false);
          return;
        }

        const opts: uPlot.Options = {
          width: container.clientWidth,
          height: 300,
          series: [
            {},
            {
              label: 'Players',
              stroke: '#3b82f6',
              width: 2,
              fill: 'rgba(59, 130, 246, 0.1)',
            },
          ],
          axes: [
            {},
            {
              label: 'Players',
              size: 50,
            },
          ],
        };

        chartRef.current = new uPlot(opts, json.data, container);
        setLoading(false);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to load chart data';
        setError(message);
        setLoading(false);
      }
    };

    void fetchAndRender();

    return () => {
      controller.abort();
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [serverId, range]);

  // Resize observer for responsive chart
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && chartRef.current) {
        chartRef.current.setSize({
          width: entry.contentRect.width,
          height: 300,
        });
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleRangeChange = useCallback((newRange: TimeRange) => {
    setRange(newRange);
  }, []);

  return (
    <div class="space-y-4">
      {/* Time range buttons */}
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-gray-600 dark:text-gray-400">
          Time Range:
        </span>
        <div class="flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleRangeChange(opt.value)}
              class={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                range === opt.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      {stats && !isEmpty && (
        <div class="flex gap-6 text-sm">
          <div>
            <span class="font-medium text-gray-500 dark:text-gray-400">Peak: </span>
            <span class="font-semibold text-gray-900 dark:text-gray-100">{stats.peak}</span>
          </div>
          <div>
            <span class="font-medium text-gray-500 dark:text-gray-400">Avg: </span>
            <span class="font-semibold text-gray-900 dark:text-gray-100">{Math.round(stats.avg)}</span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div class="flex h-[300px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
          <span class="text-sm text-gray-500 dark:text-gray-400">Loading chart...</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div class="flex h-[300px] items-center justify-center rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <span class="text-sm text-red-600 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !loading && !error && (
        <div class="flex h-[300px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
          <span class="text-sm text-gray-500 dark:text-gray-400">No historical data available</span>
        </div>
      )}

      {/* Chart container */}
      <div
        ref={containerRef}
        class={`min-h-[300px] ${loading || error || isEmpty ? 'hidden' : ''}`}
      />
    </div>
  );
}
