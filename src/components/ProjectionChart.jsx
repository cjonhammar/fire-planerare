import React, { useMemo } from 'react'
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
import { projection, formatMkr, formatKr } from '../calculations.js'
import InfoTip from './InfoTip.jsx'

const fmtAxis = (v) => (v / 1_000_000).toFixed(0)

function TooltipBox({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-md border border-border bg-bg/95 px-3 py-2 text-xs">
      <div className="mb-1 font-semibold text-gray-200">
        Ålder {label} · {row.phase}
      </div>
      <div className="text-fire-orange">Portfölj: {formatMkr(row.capital)}</div>
      {row.iskWithdrawal > 0 && (
        <div className="text-fire-blue">ISK-uttag: {formatKr(row.iskWithdrawal)}/år</div>
      )}
    </div>
  )
}

export default function ProjectionChart({ inputs, schedule }) {
  const data = useMemo(() => projection(inputs, schedule), [inputs, schedule])

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-gray-200">
          Deterministisk portföljutveckling
          <InfoTip text="Framskrivning av portföljen med fast nettoavkastning (avkastning minus ISK-schablonskatt). Ingen slump — ett enda förväntat utfall. 🔥 markerar FIRE-åldern, då uttagen börjar." />
        </h3>
        <span className="text-xs text-gray-400">
          Avkastning {(inputs.returnRate * 100).toFixed(1)}% · ålder{' '}
          {inputs.currentAge}–{inputs.lifeExpectancy}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="capFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#2e3347" strokeDasharray="3 3" />
          <XAxis dataKey="age" stroke="#6b7280" fontSize={11} />
          <YAxis
            stroke="#6b7280"
            fontSize={11}
            tickFormatter={fmtAxis}
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
          <ReferenceLine
            x={inputs.fireAge}
            stroke="#22c55e"
            strokeDasharray="4 4"
            label={({ viewBox }) => (
              <text x={viewBox.x + 4} y={viewBox.y + viewBox.height * 0.10} fill="#22c55e" fontSize={10} textAnchor="start">
                🔥 FIRE
              </text>
            )}
          />
          <Area
            dataKey="capital"
            stroke="#f97316"
            strokeWidth={2}
            fill="url(#capFill)"
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
