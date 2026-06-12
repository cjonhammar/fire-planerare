import React, { useMemo, useState } from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { formatMkr, monteCarlo } from '../calculations.js'
import SpaghettiPlot from './SpaghettiPlot.jsx'
import SuccessRateChart from './SuccessRateChart.jsx'
import InfoTip from './InfoTip.jsx'

const fmtMkrAxis = (v) => (v / 1_000_000).toFixed(0)

function TooltipBox({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-md border border-border bg-bg/95 px-3 py-2 text-xs">
      <div className="mb-1 font-semibold text-gray-200">Ålder {label}</div>
      <div className="text-fire-green">Median: {formatMkr(row.p50)}</div>
      <div className="text-gray-400">P10: {formatMkr(row.p10)}</div>
      <div className="text-gray-400">P90: {formatMkr(row.p90)}</div>
    </div>
  )
}

export default function MonteCarloChart({ inputs, mc, schedule }) {
  const [randInfl, setRandInfl] = useState(false)
  // När slumpmässig inflation är på körs en egen MC med inflationsvolatilitet
  // (PV: σ = 3 %). Annars används den färdiga mc:n från förälder (fast inflation).
  const activeMc = useMemo(
    () => (randInfl && schedule ? monteCarlo(inputs, schedule, { inflStd: 0.03 }) : mc),
    [randInfl, schedule, inputs, mc]
  )
  // Stack the bands: render lower edges as transparent, then deltas as filled.
  const data = activeMc.fan.map((d) => ({
    age: d.age,
    p10: d.p10,
    p25: d.p25,
    p50: d.p50,
    p75: d.p75,
    p90: d.p90,
    // band deltas, stacked on top of p10 base
    base: Math.max(0, d.p10),
    band1: Math.max(0, d.p25 - d.p10), // p10–p25
    band2: Math.max(0, d.p75 - d.p25), // p25–p75
    band3: Math.max(0, d.p90 - d.p75), // p75–p90
  }))

  return (
    <div className="space-y-6">
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-200">
          Monte Carlo — portföljutveckling
          <InfoTip text="Tusentals simuleringar med slumpmässig årsavkastning (µ = din avkastning, σ = 15 %, ISK-skatt avdragen). Banden visar percentiler: mörkt = P25–P75, ljust = P10–P90. Linjen är medianen (P50)." />
        </h3>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={randInfl}
              onChange={(e) => setRandInfl(e.target.checked)}
              className="h-3.5 w-3.5 accent-fire-orange"
            />
            Slumpmässig inflation
            <InfoTip text="Låter inflationen variera (µ = din inflation, σ = 3 %) i stället för fast. Uttagen skalas med den slumpade inflationen, vilket vidgar osäkerheten — särskilt sent i livet." />
          </label>
          <span className="text-xs text-gray-400">
            {activeMc.successRate.toFixed(1)}% överlever till {inputs.lifeExpectancy}
          </span>
        </div>
      </div>
      {/* ComposedChart krävs — i en AreaChart ignorerar recharts <Line>-barn,
          så medianlinjen renderades aldrig trots att legenden visade den. */}
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#2e3347" strokeDasharray="3 3" />
          <XAxis dataKey="age" stroke="#6b7280" fontSize={11} />
          <YAxis
            stroke="#6b7280"
            fontSize={11}
            tickFormatter={fmtMkrAxis}
            width={36}
            label={{
              value: 'Mkr',
              angle: -90,
              position: 'insideLeft',
              fill: '#6b7280',
              fontSize: 11,
            }}
          />
          <Tooltip content={<TooltipBox />} />
          <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="2 2" />

          {/* transparent base up to p10 */}
          <Area
            dataKey="base"
            stackId="band"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
          />
          {/* p10–p25 amber */}
          <Area
            dataKey="band1"
            stackId="band"
            stroke="none"
            fill="#f59e0b"
            fillOpacity={0.25}
          />
          {/* p25–p75 green */}
          <Area
            dataKey="band2"
            stackId="band"
            stroke="none"
            fill="#22c55e"
            fillOpacity={0.3}
          />
          {/* p75–p90 light green */}
          <Area
            dataKey="band3"
            stackId="band"
            stroke="none"
            fill="#86efac"
            fillOpacity={0.25}
          />
          {/* median line */}
          <Line
            dataKey="p50"
            stroke="#22c55e"
            strokeWidth={2.5}
            dot={false}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-gray-400">
        <Legend color="#f59e0b" label="P10–P25" />
        <Legend color="#22c55e" label="P25–P75" />
        <Legend color="#86efac" label="P75–P90" />
        <Legend color="#22c55e" label="Median" line />
      </div>

      {activeMc.samplePaths?.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-2 text-[11px] font-medium text-gray-400">Spaghetti-plot — 100 enskilda banor
            <InfoTip text="100 slumpvis utvalda simuleringsbanor, en linje per möjligt utfall. Visar hur banorna spretar över tid och var de kraschar — en känsla för osäkerheten bortom percentilbanden." />
          </p>
          <SpaghettiPlot samplePaths={activeMc.samplePaths} ages={activeMc.allAges} maxCap={activeMc.maxCap} />
        </div>
      )}
    </div>

    <SuccessRateChart successByAge={activeMc.successByAge} />
    </div>
  )
}

function Legend({ color, label, line }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="inline-block"
        style={{
          width: 14,
          height: line ? 3 : 10,
          background: color,
          opacity: line ? 1 : 0.4,
          borderRadius: 2,
        }}
      />
      {label}
    </span>
  )
}
