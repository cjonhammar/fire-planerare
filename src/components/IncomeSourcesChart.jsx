import React, { useMemo } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { incomeSources, depletion, formatKr } from '../calculations.js'
import InfoTip from './InfoTip.jsx'

const fmtAxis = (v) => `${Math.round(v / 1000)}k`

const COLORS = {
  lon:      '#fbbf24',  // lön netto (pre-FIRE) — gul
  tjanste:  '#22c55e',  // tjänstepension — grön
  allman:   '#14b8a6',  // allmän pension — teal
  stiftelse: '#a78bfa',  // stiftelse-utbetalning — lila
  extraWork: '#ec4899',  // extrajobb (lön) — rosa
  isk:      '#3b82f6',  // ISK-uttag — blå
  extra:    '#f97316',  // extra uttag — orange
  skatt:    '#ef4444',  // inkomstskatt — röd
}

function TooltipBox({ active, payload, label, stiftelseName = 'Stiftelse', extraWorkName = 'Extrajobb' }) {
  if (!active || !payload || !payload.length) return null
  const get = (k) => payload.find((p) => p.dataKey === k)?.value ?? 0
  const rate = payload.find((p) => p.payload?.effectiveRate != null)?.payload?.effectiveRate
  return (
    <div className="rounded-md border border-border bg-bg/95 px-3 py-2 text-xs min-w-[200px]">
      <div className="mb-2 font-semibold text-gray-200">Ålder {label}</div>

      <div className="space-y-1">
        {get('lon') > 0 && (
          <div className="flex justify-between gap-4">
            <span style={{ color: COLORS.lon }}>Lön (netto)</span>
            <span className="text-gray-200">{formatKr(get('lon'))}/mån</span>
          </div>
        )}
        {get('tjanste') > 0 && (
          <div className="flex justify-between gap-4">
            <span style={{ color: COLORS.tjanste }}>Tjänstepension</span>
            <span className="text-gray-200">{formatKr(get('tjanste'))}/mån</span>
          </div>
        )}
        {get('allman') > 0 && (
          <div className="flex justify-between gap-4">
            <span style={{ color: COLORS.allman }}>Allmän pension</span>
            <span className="text-gray-200">{formatKr(get('allman'))}/mån</span>
          </div>
        )}
        {get('stiftelse') > 0 && (
          <div className="flex justify-between gap-4">
            <span style={{ color: COLORS.stiftelse }}>{stiftelseName}</span>
            <span className="text-gray-200">{formatKr(get('stiftelse'))}/mån</span>
          </div>
        )}
        {get('extraWork') > 0 && (
          <div className="flex justify-between gap-4">
            <span style={{ color: COLORS.extraWork }}>{extraWorkName}</span>
            <span className="text-gray-200">{formatKr(get('extraWork'))}/mån</span>
          </div>
        )}
        {get('isk') > 0 && (
          <div className="flex justify-between gap-4">
            <span style={{ color: COLORS.isk }}>ISK-uttag</span>
            <span className="text-gray-200">{formatKr(get('isk'))}/mån</span>
          </div>
        )}
        {get('extra') > 0 && (
          <div className="flex justify-between gap-4">
            <span style={{ color: COLORS.extra }}>Extra uttag</span>
            <span className="text-gray-200">{formatKr(get('extra') * 12)}/år</span>
          </div>
        )}
      </div>

      <div className="my-1.5 border-t border-border" />

      <div className="flex justify-between gap-4 text-gray-300">
        <span>Önskat netto</span>
        <span>{formatKr(get('desired'))}/mån</span>
      </div>

      {get('skatt') > 0 && (
        <div className="mt-1.5 border-t border-border pt-1.5">
          <div className="flex justify-between gap-4">
            <span style={{ color: COLORS.skatt }}>Inkomstskatt</span>
            <span style={{ color: COLORS.skatt }}>
              {formatKr(get('skatt'))}/mån
              {rate != null && ` (${(rate * 100).toFixed(1)}%)`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function IncomeSourcesChart({ inputs, schedule }) {
  const data = useMemo(() => incomeSources(inputs, schedule), [inputs, schedule])
  const dep = useMemo(() => depletion(inputs, schedule), [inputs, schedule])
  const hasStiftelse = useMemo(() => data.some((d) => d.stiftelse > 0), [data])
  const hasExtraWork = useMemo(() => data.some((d) => d.extraWork > 0), [data])
  const hasLon = useMemo(() => data.some((d) => d.lon > 0), [data])

  return (
    <div
      className={`rounded-xl bg-surface p-4 ${
        dep.depleted
          ? 'border-2 border-fire-red ring-1 ring-fire-red/40'
          : 'border border-border'
      }`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">
            Inkomstkällor per år (kr/mån)
            <InfoTip text="Nettoinkomst per år uppdelad på källa (lön, pensioner, stiftelse, extrajobb, ISK-uttag). Staplarna staplas upp till önskat netto; röd topp = inkomstskatt. Pension och arbetsinkomst (stiftelse + extrajobb) sambeskattas, med jobbskatteavdrag på arbetsinkomsten. Vit linje = önskad nettoutgift." />
          </h3>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Staplar = netto. Röd topp = inkomstskatt (sambeskattning: pension + arbetsinkomst, JAS på arbetsdelen).
          </p>
        </div>
        {dep.depleted && (
          <span className="rounded bg-fire-red/15 px-2 py-0.5 text-xs font-medium text-fire-red whitespace-nowrap">
            ⚠ Tar slut vid {dep.age} år
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="#2e3347" strokeDasharray="3 3" />
          <XAxis
            dataKey="age"
            stroke="#6b7280"
            fontSize={11}
            interval={2}
            tickFormatter={(v) => v}
          />
          <YAxis stroke="#6b7280" fontSize={11} tickFormatter={fmtAxis} width={40} />
          <Tooltip content={<TooltipBox stiftelseName={inputs.stiftelseName} extraWorkName={inputs.extraWorkName} />} cursor={{ fill: '#ffffff08' }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />

          {/* Netto income sources — stacked */}
          {hasLon && <Bar dataKey="lon" stackId="inc" name="Lön (netto)" fill={COLORS.lon} />}
          <Bar dataKey="tjanste"  stackId="inc" name="Tjänstepension" fill={COLORS.tjanste} />
          <Bar dataKey="allman"   stackId="inc" name="Allmän pension"  fill={COLORS.allman} />
          {hasStiftelse && <Bar dataKey="stiftelse" stackId="inc" name={inputs.stiftelseName || 'Stiftelse'} fill={COLORS.stiftelse} />}
          {hasExtraWork && <Bar dataKey="extraWork" stackId="inc" name={inputs.extraWorkName || 'Extrajobb'} fill={COLORS.extraWork} />}
          <Bar dataKey="isk"      stackId="inc" name="ISK-uttag"       fill={COLORS.isk} />
          <Bar
            dataKey="extra"
            stackId="inc"
            name="Extra uttag"
            fill={COLORS.extra}
          />
          {/* Tax — stacked on top, shows the "overhead" above netto spend */}
          <Bar
            dataKey="skatt"
            stackId="inc"
            name="Inkomstskatt"
            fill={COLORS.skatt}
            fillOpacity={0.75}
            radius={[3, 3, 0, 0]}
          />

          {/* Desired netto spend line */}
          <Line
            dataKey="desired"
            name="Önskat netto"
            stroke="#e5e7eb"
            strokeWidth={1.5}
            dot={false}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
