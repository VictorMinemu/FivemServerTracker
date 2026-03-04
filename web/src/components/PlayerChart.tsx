/**
 * PlayerChart Preact Island
 *
 * Renders a uPlot time-series chart of server player counts
 * with 24h / 7d / 30d range switching and peak/avg stats.
 */

import { useRef, useEffect, useState, useCallback } from 'preact/hooks';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

import type { HistoryResponse, TimeRange } from '../lib/history-queries.js';

interface PlayerChartProps {
  serverId: string;
}

interface ChartStats {
  peak: number;
  avg: number;
}

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

export default function PlayerChart({ serverId }: PlayerChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);

  const [range, setRange] = useState<TimeRange>('24h');
  const [stats, setStats] = useState<ChartStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(false);

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

        if (chartRef.current) {
          chartRef.current.destroy();
          chartRef.current = null;
        }

        if (json.data[0].length === 0) {
          setIsEmpty(true);
          setLoading(false);
          return;
        }

        const container = containerRef.current;
        if (!container) {
          setLoading(false);
          return;
        }

        const accentColor = '#34d399';
        const gridColor = 'rgba(31, 33, 56, 0.6)';
        const textColor = '#8f91ae';

        const opts: uPlot.Options = {
          width: container.clientWidth,
          height: 280,
          padding: [16, 8, 0, 0],
          cursor: {
            points: { size: 6 },
          },
          series: [
            {},
            {
              label: 'Players',
              stroke: accentColor,
              width: 2,
              fill: `${accentColor}12`,
              points: { show: false },
            },
          ],
          axes: [
            {
              stroke: textColor,
              grid: { stroke: gridColor, width: 1 },
              ticks: { stroke: gridColor, width: 1 },
              font: '12px Outfit, sans-serif',
            },
            {
              stroke: textColor,
              grid: { stroke: gridColor, width: 1 },
              ticks: { stroke: gridColor, width: 1 },
              font: '12px Outfit, sans-serif',
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && chartRef.current) {
        chartRef.current.setSize({
          width: entry.contentRect.width,
          height: 280,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleRangeChange = useCallback((newRange: TimeRange) => {
    setRange(newRange);
  }, []);

  return (
    <div class="space-y-4">
      {/* Controls row */}
      <div class="flex items-center justify-between">
        <div class="flex gap-1 rounded-lg bg-surface-0 p-1 ring-1 ring-edge">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleRangeChange(opt.value)}
              class={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                range === opt.value
                  ? 'bg-accent text-surface-0 shadow-sm'
                  : 'text-txt-2 hover:text-txt hover:bg-surface-3'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Stats */}
        {stats && !isEmpty && (
          <div class="flex gap-5 text-sm">
            <div class="flex items-center gap-1.5">
              <span class="text-txt-3 text-xs font-medium uppercase tracking-wide">Peak</span>
              <span class="font-bold text-txt tabular-nums">{stats.peak}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-txt-3 text-xs font-medium uppercase tracking-wide">Avg</span>
              <span class="font-bold text-txt tabular-nums">{Math.round(stats.avg)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div class="flex h-[280px] items-center justify-center rounded-lg bg-surface-0 ring-1 ring-edge">
          <div class="flex items-center gap-2 text-sm text-txt-3">
            <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading chart...
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div class="flex h-[280px] items-center justify-center rounded-lg bg-offline/5 ring-1 ring-offline/20">
          <span class="text-sm text-offline">{error}</span>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !loading && !error && (
        <div class="flex h-[280px] items-center justify-center rounded-lg bg-surface-0 ring-1 ring-edge">
          <span class="text-sm text-txt-3">No historical data available</span>
        </div>
      )}

      {/* Chart container */}
      <div
        ref={containerRef}
        class={`min-h-[280px] ${loading || error || isEmpty ? 'hidden' : ''}`}
      />
    </div>
  );
}
