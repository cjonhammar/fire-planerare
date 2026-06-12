import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { dieWithZero, dwzTrajectories, formatKr, formatMkr } from '../calculations.js'
import InfoTip from './InfoTip.jsx'

const fmtAxis = (v) => (v / 1_000_000).toFixed(1)

function Stat({ label, value, accent, big }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div
        className={big ? 'text-2xl font-bold' : 'text-lg font-semibold'}
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
    </div>
  )
}

function TooltipBox({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const get = (k) => payload.find((p) => p.dataKey === k)?.value
  return (
    <div className="rounded-md border border-border bg-bg/95 px-3 py-2 text-xs">
      <div className="mb-1 font-semibold text-gray-200">Ålder {label}</div>
      {get('standard') != null && (
        <div className="text-fire-blue">Standard: {formatMkr(get('standard'))}</div>
      )}
      {get('dwz') != null && (
        <div className="text-fire-orange">Die With Zero: {formatMkr(get('dwz'))}</div>
      )}
    </div>
  )
}

export default function DieWithZeroPanel({ inputs, update, schedule }) {
  const result = useMemo(() => dieWithZero(inputs, schedule), [inputs, schedule])
  const traj = useMemo(() => dwzTrajectories(inputs, schedule), [inputs, schedule])

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-200">
          Die With Zero — maximera konsumtionen
          <InfoTip text="Hur mycket du maximalt kan konsumera per månad om portföljen ska landa exakt på ditt arvsmål vid livslängdens slut, jämfört med standardplanen. Visar extra konsumtionsutrymme per månad och över livet." />
        </h3>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          Lämna kvar (arv)
          <input
            type="number"
            step={100000}
            value={inputs.targetEstate}
            onChange={(e) => update({ targetEstate: Number(e.target.value) })}
            className="w-32 rounded-md border border-border bg-bg px-2 py-1 text-gray-100 focus:border-fire-orange focus:outline-none"
          />
          kr
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Standard */}
        <div className="rounded-lg border border-border bg-bg/40 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-fire-blue">
            Standardplan
          </div>
          <div className="space-y-3">
            <Stat
              label={`Månadsbelopp vid ${inputs.fireAge}`}
              value={`${formatKr(schedule[0]?.spend ?? inputs.desiredSpend)}/mån`}
            />
            <Stat
              label={`Portfölj vid ${inputs.lifeExpectancy}`}
              value={formatKr(result.standard.portfolioAt90)}
              accent={result.standard.portfolioAt90 >= 0 ? '#22c55e' : '#ef4444'}
            />
            <Stat
              label="Totalt ISK-uttag"
              value={formatKr(result.standard.totalWithdrawn)}
            />
          </div>
        </div>

        {/* Die With Zero */}
        <div className="rounded-lg border border-fire-orange/40 bg-fire-orange/5 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-fire-orange">
            Die With Zero
          </div>
          <div className="space-y-3">
            <Stat
              label={`Max månadsbelopp vid ${inputs.fireAge}`}
              value={`${formatKr(result.dwzMonthlySpend)}/mån`}
            />
            <Stat
              label={`Portfölj vid ${inputs.lifeExpectancy}`}
              value={`≈ ${formatKr(result.dwz.portfolioAt90)}`}
            />
            <Stat
              label="Totalt ISK-uttag"
              value={formatKr(result.dwz.totalWithdrawn)}
            />
          </div>
        </div>
      </div>

      {/* Extra highlight */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-fire-orange/40 bg-fire-orange/10 p-4">
          <Stat
            label="Extra per månad vs standard"
            value={`+${formatKr(result.extraPerMonth)}/mån`}
            accent="#f97316"
            big
          />
        </div>
        <div className="rounded-lg border border-border bg-bg/40 p-4">
          <Stat
            label="Extra över livstiden"
            value={`+${formatKr(result.extraLifetime)}`}
            accent="#f97316"
          />
        </div>
      </div>

      {/* Trajectory chart */}
      <div className="mt-5">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={traj} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="2 2" />
            <Line
              dataKey="standard"
              name="Standard"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              type="monotone"
            />
            <Line
              dataKey="dwz"
              name="Die With Zero"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              type="monotone"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
