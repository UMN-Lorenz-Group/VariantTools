'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubstitutionTypeDatum {
  type: string;
  count: number;
  pct: number | null;
}

export interface PerSampleDatum {
  sample_id: string;
  hom_RR: number;
  het: number;
  hom_AA: number;
  missing: number;
}

// ---------------------------------------------------------------------------
// Color palette for substitution types
// ---------------------------------------------------------------------------
const ST_COLORS: Record<string, string> = {
  'A>C': '#60a5fa',
  'A>G': '#34d399',
  'A>T': '#f472b6',
  'C>A': '#fb923c',
  'C>G': '#a78bfa',
  'C>T': '#facc15',
  'G>A': '#4ade80',
  'G>C': '#f87171',
  'G>T': '#38bdf8',
  'T>A': '#c084fc',
  'T>C': '#fbbf24',
  'T>G': '#86efac',
};

const DEFAULT_COLOR = '#94a3b8';

// ---------------------------------------------------------------------------
// Substitution Type Chart
// ---------------------------------------------------------------------------

interface SubstitutionTypeChartProps {
  data: SubstitutionTypeDatum[];
}

interface TooltipPayloadItem {
  value: number;
  payload: SubstitutionTypeDatum;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function SubTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
      <p className="font-semibold text-white mb-1">{label}</p>
      <p className="text-gray-300">Count: {d.count.toLocaleString()}</p>
      {d.pct != null && (
        <p className="text-gray-300">Percentage: {d.pct.toFixed(2)}%</p>
      )}
    </div>
  );
}

export function SubstitutionTypeChart({ data }: SubstitutionTypeChartProps) {
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">No substitution type data available.</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
        <XAxis
          dataKey="type"
          tick={{ fill: '#9ca3af', fontSize: 12 }}
          axisLine={{ stroke: '#374151' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => v.toLocaleString()}
        />
        <Tooltip content={<SubTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.type}
              fill={ST_COLORS[entry.type] ?? DEFAULT_COLOR}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Per-sample Missing Data Chart
// ---------------------------------------------------------------------------

interface PerSampleMissingChartProps {
  data: PerSampleDatum[];
}

interface MissingTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: PerSampleDatum & { missingPct: number } }>;
  label?: string;
}

function MissingTooltip({ active, payload, label }: MissingTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const total = d.hom_RR + d.het + d.hom_AA + d.missing;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs">
      <p className="font-semibold text-white mb-1">{label}</p>
      <p className="text-gray-300">Missing: {d.missing.toLocaleString()}</p>
      <p className="text-gray-300">
        Missing %: {total > 0 ? ((d.missing / total) * 100).toFixed(2) : '0.00'}%
      </p>
      <p className="text-gray-400 mt-1">Hom ref: {d.hom_RR.toLocaleString()}</p>
      <p className="text-gray-400">Het: {d.het.toLocaleString()}</p>
      <p className="text-gray-400">Hom alt: {d.hom_AA.toLocaleString()}</p>
    </div>
  );
}

export function PerSampleMissingChart({ data }: PerSampleMissingChartProps) {
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">No per-sample data available.</p>
    );
  }

  // Compute missing percentage for each sample
  const enriched = data.map((s) => {
    const total = s.hom_RR + s.het + s.hom_AA + s.missing;
    return { ...s, missingPct: total > 0 ? (s.missing / total) * 100 : 0 };
  });

  const chartHeight = Math.max(200, Math.min(data.length * 28, 500));

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        layout="vertical"
        data={enriched}
        margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          axisLine={{ stroke: '#374151' }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="sample_id"
          width={120}
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<MissingTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        <Bar dataKey="missingPct" fill="#f87171" radius={[0, 4, 4, 0]} name="Missing %" />
      </BarChart>
    </ResponsiveContainer>
  );
}
