import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import InfoTip from './InfoTip.jsx'

function TooltipBox({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const v = payload[0].value
  return (
    <div className="rounded-md border border-border bg-bg/95 px-3 py-2 text-xs">
      <div className="mb-1 font-semibold text-gray-200">Ålder {label}</div>
      <div className="text-fire-green">{v.toFixed(1)}% solventa</div>
    </div>
  )
}

export default function SuccessRateChart({ successByAge }) {
  if (!successByAge?.length) return null
  const min = Math.min(...successByAge.map((d) => d.solvent))
  // Zoom y-axis to the relevant band but never above 0; floor a touch under min.
  const yMin = Math.max(0, Math.floor((min - 5) / 10) * 10)

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-200">
        Sannolikhet att klara målen — per år
        <InfoTip text="Andel av Monte Carlo-banorna vars portfölj fortfarande är solvent (> 0) vid varje ålder. Faller kurvan brant i slutet betyder det att pengarna riskerar att ta slut sent i livet." />
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={successByAge} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="solventFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#2e3347" strokeDasharray="3 3" />
          <XAxis dataKey="age" stroke="#6b7280" fontSize={11} />
          <YAxis
            stroke="#6b7280"
            fontSize={11}
            domain={[yMin, 100]}
            tickFormatter={(v) => `${v}%`}
            width={40}
          />
          <Tooltip content={<TooltipBox />} />
          <ReferenceLine y={90} stroke="#f59e0b" strokeDasharray="2 2" label={{ value: '90%', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }} />
          <Area
            dataKey="solvent"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#solventFill)"
            type="monotone"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
