import React, { useState, useMemo } from 'react'
import {
  householdProjection,
  householdMonteCarlo,
  householdSuccessRateBySpend,
  formatKr,
  formatMkr,
} from '../calculations.js'
import SpaghettiPlot from './SpaghettiPlot.jsx'
import InfoTip from './InfoTip.jsx'
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'

function Card({ title, value, sub, accent, info }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between text-xs uppercase tracking-wide text-gray-400">
        <span>{title}</span>
        {info && <InfoTip text={info} />}
      </div>
      <div className="mt-2 text-xl font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  )
}

function NumberInput({ label, value, onChange, step = 1000, suffix, min }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-gray-400">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-gray-100 focus:border-fire-orange focus:outline-none"
        />
        {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
      </div>
    </label>
  )
}

function fmtM(v) {
  if (v == null || isNaN(v) || v === 0) return '0 Mkr'
  return formatMkr(v)
}

const tickStyle = { fill: '#9ca3af', fontSize: 11 }

// ── 4. Heatmap ────────────────────────────────────────────────────────────────
function HeatmapChart({ heatmapData, bucketSize, BUCKETS }) {
  if (!heatmapData?.length) return null
  const maxCount = Math.max(...heatmapData.flatMap(d => d.counts))
  const cellH = 14
  const rows = Array.from({ length: BUCKETS }, (_, b) => BUCKETS - 1 - b)
  return (
    <div className="overflow-x-auto">
      <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(${heatmapData.length}, 1fr)`, fontSize: 9, gap: 1 }}>
        {/* Y-axis labels + row */}
        {rows.map(b => (
          <React.Fragment key={b}>
            <div style={{ height: cellH, lineHeight: `${cellH}px`, textAlign: 'right', paddingRight: 4, color: '#6b7280', whiteSpace: 'nowrap' }}>
              {b % 5 === 0 ? `${(b * bucketSize / 1e6).toFixed(0)} Mkr` : ''}
            </div>
            {heatmapData.map(({ calYear, counts }) => {
              const density = maxCount > 0 ? counts[b] / maxCount : 0
              const alpha = density ** 0.5
              return (
                <div key={calYear} style={{
                  height: cellH,
                  background: `rgba(59,130,246,${alpha.toFixed(3)})`,
                  borderRadius: 1,
                }} title={`${calYear} / ${(b * bucketSize / 1e6).toFixed(1)}–${((b + 1) * bucketSize / 1e6).toFixed(1)} Mkr: ${counts[b]} sim`} />
              )
            })}
          </React.Fragment>
        ))}
        {/* X-axis labels */}
        <div />
        {heatmapData.map(({ calYear }) => (
          <div key={calYear} style={{ textAlign: 'center', color: '#6b7280', paddingTop: 2, fontSize: 9 }}>
            {calYear % 10 === 0 ? calYear : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

function XTick({ x, y, payload }) {
  if (payload.value % 5 !== 0) return null
  return (
    <text x={x} y={y + 12} textAnchor="middle" fill="#9ca3af" fontSize={11}>
      {payload.value}
    </text>
  )
}

// Reference line label rendered 10% down from the top of the chart area
function refLabel(text, color, anchor = 'start', offset = 4) {
  return ({ viewBox }) => (
    <text
      x={viewBox.x + offset}
      y={viewBox.y + viewBox.height * 0.10}
      fill={color}
      fontSize={9}
      textAnchor={anchor}
    >
      {text}
    </text>
  )
}

function TooltipCapital({ active, payload, p1Name, p2Name }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="rounded-lg border border-border bg-surface p-3 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-gray-200">
        {d.calYear} · {p1Name} {d.p1Age} år · {p2Name} {d.p2Age} år
      </p>
      <p style={{ color: '#f97316' }}>{p1Name}s portfölj: {formatMkr(d.capitalP1)}</p>
      <p style={{ color: '#14b8a6' }}>{p2Name}s portfölj: {formatMkr(d.capitalP2)}</p>
      <p className="mt-1 border-t border-border pt-1 text-gray-300">
        Totalt: {formatMkr(d.capital)}
      </p>
      {d.inheritedByChild > 0 && (
        <p className="mt-1 text-amber-400">
          Arv till barn: {formatMkr(d.inheritedByChild)}
        </p>
      )}
      {!d.p1Alive && <p className="mt-1 text-red-400">{p1Name} har gått bort</p>}
    </div>
  )
}

function TooltipIncome({ active, payload, p1Name, p2Name }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const totalNetto = (d.p1WorkIncome ?? 0) + (d.p2WorkIncome ?? 0)
    + (d.p1Pension ?? 0) + (d.p2Pension ?? 0)
    + (d.p1IskMonthly ?? 0) + (d.p2IskMonthly ?? 0)
  return (
    <div className="rounded-lg border border-border bg-surface p-3 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-gray-200">
        {d.calYear} · {p1Name} {d.p1Age} år · {p2Name} {d.p2Age} år
      </p>
      {payload
        .filter((p) => p.dataKey !== 'spend' && p.value > 0)
        .map((p) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {formatKr(Math.round(p.value))}/mån
          </p>
        ))}
      <p className="mt-1 border-t border-border pt-1 text-gray-400">
        Totalt netto: {formatKr(Math.round(totalNetto))}/mån
      </p>
      <p className="text-white/70">
        Önskad utgift: {formatKr(Math.round(d.spend))}/mån
      </p>
    </div>
  )
}

export default function HouseholdPage({
  p1inputs, p2inputs, p1schedule, p2schedule,
  defaultHhSpend, defaultP1GrossSalary, defaultP2GrossSalary, survivorFraction = 0.5, baseCalYear,
}) {
  const [hhSpend, setHhSpend] = useState(defaultHhSpend ?? 70000)
  // Löner och arvsdelning läses enbart från config-filen (inte redigerbara här)
  const p1Gross = defaultP1GrossSalary ?? 0
  const p2Gross = defaultP2GrossSalary ?? 0
  // Namn från config — inga personnamn hårdkodas i källkoden
  const p1Name = p1inputs.name || 'Person 1'
  const p2Name = p2inputs.name || 'Partner'

  const rows = useMemo(
    () => householdProjection(
      p1inputs, p2inputs, hhSpend, p2Gross, p1Gross,
      p1schedule, p2schedule, baseCalYear, survivorFraction
    ),
    [p1inputs, p2inputs, hhSpend, p1Gross, p2Gross, p1schedule, p2schedule, baseCalYear, survivorFraction]
  )

  const mc = useMemo(
    () => householdMonteCarlo(
      p1inputs, p2inputs, hhSpend, p2Gross, p1Gross,
      p1schedule, p2schedule, baseCalYear, survivorFraction
    ),
    [p1inputs, p2inputs, hhSpend, p1Gross, p2Gross, p1schedule, p2schedule, baseCalYear, survivorFraction]
  )

  const spendSensitivity = useMemo(
    () => householdSuccessRateBySpend(
      p1inputs, p2inputs, hhSpend, p2Gross, p1Gross,
      p1schedule, p2schedule, baseCalYear, survivorFraction
    ),
    [p1inputs, p2inputs, hhSpend, p1Gross, p2Gross, p1schedule, p2schedule, baseCalYear, survivorFraction]
  )

  // Histogram över slutkapital. Medianmarkören måste sättas till etiketten för
  // den bucket medianen ligger i — kategoriaxeln matchar exakta strängar, så en
  // avrundad Mkr-siffra träffar annars fel stapel eller ingen alls.
  const histogram = useMemo(() => {
    if (!mc.finalCapitals?.length) return { data: [], medianLabel: null }
    const N = 30
    const bSz = Math.max(...mc.finalCapitals) / N || 1
    const data = Array.from({ length: N }, (_, i) => {
      const count = mc.finalCapitals.filter(
        (v) => v >= i * bSz && (i === N - 1 || v < (i + 1) * bSz)
      ).length
      return { label: `${((i * bSz) / 1e6).toFixed(0)}`, pct: (count / mc.finalCapitals.length) * 100 }
    })
    const mi = Math.min(N - 1, Math.max(0, Math.floor(mc.medianAtEnd / bSz)))
    return { data, medianLabel: data[mi].label }
  }, [mc])

  const p1FireYear = p1inputs.birthYear + p1inputs.fireAge
  const p2FireYear = p2inputs.birthYear + p2inputs.fireAge
  const p1DeathYear = p1inputs.birthYear + p1inputs.lifeExpectancy
  const p2DeathYear = p2inputs.birthYear + p2inputs.lifeExpectancy

  const startRow = rows[0]
  const atP1Death = rows.find((r) => r.calYear === p1DeathYear)
  const afterP1Death = rows.find((r) => r.calYear === p1DeathYear + 1)
  const lastRow = rows[rows.length - 1]
  const depletesRow = rows.find((r) => r.capital <= 0)
  const startCapital = (startRow?.capital ?? 0) +
    (startRow ? startRow.p1IskMonthly * 12 + startRow.p2IskMonthly * 12 : 0)

  const inheritedByChild = afterP1Death?.inheritedByChild ?? 0

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Settings */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-300">⚙️ Hushållsinställningar</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberInput
            label="Hushållets önskade utgift (kr/mån)"
            value={hhSpend}
            onChange={setHhSpend}
            step={1000}
            suffix="kr/mån"
          />
          <div className="rounded-lg border border-border bg-bg p-3 text-xs text-gray-400 space-y-1">
            <p><span className="text-gray-300 font-medium">Tidslinje</span></p>
            <p>{baseCalYear ?? '–'}–{p1FireYear}: båda arbetar</p>
            <p>{p1FireYear}: 🔥 {p1Name} FIRE</p>
            <p>{p2FireYear}: 🎉 {p2Name} FIRE</p>
            <p>{p1DeathYear}: † {p1Name} dör</p>
            <p>{p2DeathYear}: {p2Name} {p2inputs.lifeExpectancy} år</p>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Card
          title="Kombinerat kapital idag"
          value={fmtM(startRow?.capital)}
          sub={`${baseCalYear ?? ''}`}
          info="Bådas fria kapital (ISK + PP) sammanlagt vid startåret."
        />
        <Card
          title={`${p1Name}s portfölj ${p1DeathYear} (före arv)`}
          value={fmtM(atP1Death?.capitalP1)}
          sub={`vid bortgång · kombinerat ${fmtM(atP1Death?.capital)}`}
          accent="#f59e0b"
          info={`Värdet av ${p1Name}s egen portfölj det år hen går bort. Det är denna som delas i arv — inte det kombinerade kapitalet (visas som undertext).`}
        />
        <Card
          title="Arv till barn"
          value={fmtM(inheritedByChild)}
          sub={`${Math.round((1 - survivorFraction) * 100)}% av ${p1Name}s portfölj`}
          accent="#a78bfa"
          info={`Barnets andel av ${p1Name}s portfölj vid bortgången. Resten ärver ${p2Name}. Andelen styrs av arvsdelningen i config-filen. ${p2Name}s egen portfölj ingår inte.`}
        />
        <Card
          title={`Kapital vid slut (${p2DeathYear})`}
          value={fmtM(lastRow?.capital)}
          sub={`${p2Name} ${p2inputs.lifeExpectancy} år`}
          accent={lastRow && lastRow.capital > 0 ? '#22c55e' : '#ef4444'}
          info={`Kvarvarande kombinerat kapital vid simuleringens slut (${p2Name}s ${p2inputs.lifeExpectancy}-årsdag). Grönt = pengarna räckte, rött = underskott.`}
        />
        <Card
          title={depletesRow ? 'ISK tar slut' : 'ISK räcker hela livet'}
          value={depletesRow ? `År ${depletesRow.calYear}` : '✓'}
          sub={depletesRow ? `${p1Name} ${depletesRow.p1Age} år, ${p2Name} ${depletesRow.p2Age} år` : ''}
          accent={depletesRow ? '#ef4444' : '#22c55e'}
          info="Året då det kombinerade fria kapitalet når noll (deterministiskt scenario). ✓ betyder att det räcker hela vägen."
        />
      </div>

      {/* Capital projection — two stacked areas */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-300">Deterministisk portföljutveckling
          <InfoTip text={`Framskrivning av båda portföljerna med fast nettoavkastning (ingen slump). Orange = ${p1Name}s, teal = ${p2Name}s. Streckade linjer markerar FIRE-åldrar och ${p1Name}s bortgång.`} />
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={rows} margin={{ top: 4, right: 16, bottom: 0, left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="calYear" tick={<XTick />} height={24} />
            <YAxis
              tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}`}
              tick={tickStyle}
              width={36}
              tickCount={6}
              label={{ value: 'Mkr', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
            />
            <Tooltip content={<TooltipCapital p1Name={p1Name} p2Name={p2Name} />} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span style={{ color: '#9ca3af' }}>{v}</span>} />
            <Area type="monotone" dataKey="capitalP2" name={`${p2Name}s portfölj`}
              stackId="c" stroke="#14b8a6" fill="#14b8a6" fillOpacity={0.25} strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="capitalP1" name={`${p1Name}s portfölj`}
              stackId="c" stroke="#f97316" fill="#f97316" fillOpacity={0.3} strokeWidth={1.5} dot={false} />
            {depletesRow && <ReferenceLine x={depletesRow.calYear} stroke="#ef4444" strokeWidth={2}
              label={refLabel(`⚠ ISK slut ${depletesRow.calYear}`, '#ef4444')} />}
            <ReferenceLine x={p1FireYear} stroke="#f97316" strokeDasharray="4 3"
              label={refLabel(`🔥 ${p1FireYear}`, '#fb923c')} />
            <ReferenceLine x={p2FireYear} stroke="#14b8a6" strokeDasharray="4 3"
              label={refLabel(`🎉 ${p2FireYear}`, '#14b8a6')} />
            <ReferenceLine x={p1DeathYear} stroke="#ef4444" strokeDasharray="4 3"
              label={refLabel(`† ${p1DeathYear}`, '#ef4444')} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="mt-2 text-[11px] text-gray-500">
          Orange = {p1Name}s portfölj · Teal = {p2Name}s portfölj
        </p>
      </div>

      {/* Monte Carlo */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300">Monte Carlo — hushållets ekonomi
            <InfoTip text="Tusentals simuleringar av det kombinerade kapitalet med slumpmässig årsavkastning (µ = avkastningen, σ = 15 %, ISK-skatt avdragen). Banden visar percentiler P10–P90, linjen medianen. Arvsdelning och pensioner ingår." />
          </h2>
          <div className="flex gap-4 text-xs">
            <span className={`font-semibold ${mc.successRate > 90 ? 'text-green-400' : mc.successRate > 75 ? 'text-yellow-400' : 'text-red-400'}`}>
              {mc.successRate.toFixed(1)}% lyckas
            </span>
            <span className="text-gray-400">
              Median vid {mc.endYear}: {formatMkr(mc.medianAtEnd)}
            </span>
            <span className="text-gray-500">{mc.sims.toLocaleString('sv-SE')} sim.</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={mc.fan} margin={{ top: 4, right: 16, bottom: 0, left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="calYear" tick={<XTick />} height={24} />
            <YAxis
              tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}`}
              tick={tickStyle}
              width={36}
              tickCount={6}
              label={{ value: 'Mkr', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
            />
            <Tooltip
              formatter={(v, name) => [formatMkr(v), name]}
              contentStyle={{ background: '#1a1a1a', border: '1px solid #333', fontSize: 11 }}
              labelFormatter={(l) => `År ${l}`}
            />
            {/* p10–p90 band */}
            <Area type="monotone" dataKey="p90" stroke="none" fill="#3b82f6" fillOpacity={0.12} dot={false} legendType="none" name="P90" />
            <Area type="monotone" dataKey="p10" stroke="none" fill="#1a1a1a" fillOpacity={1} dot={false} legendType="none" name="P10" />
            {/* p25–p75 band */}
            <Area type="monotone" dataKey="p75" stroke="none" fill="#3b82f6" fillOpacity={0.2} dot={false} legendType="none" name="P75" />
            <Area type="monotone" dataKey="p25" stroke="none" fill="#1a1a1a" fillOpacity={1} dot={false} legendType="none" name="P25" />
            {/* Median */}
            <Line type="monotone" dataKey="p50" stroke="#3b82f6" strokeWidth={2} dot={false} name="Median (P50)" />
            <ReferenceLine x={p1FireYear} stroke="#f97316" strokeDasharray="4 3"
              label={refLabel(`🔥 ${p1FireYear}`, '#fb923c')} />
            <ReferenceLine x={p2FireYear} stroke="#14b8a6" strokeDasharray="4 3"
              label={refLabel(`🎉 ${p2FireYear}`, '#14b8a6')} />
            <ReferenceLine x={p1DeathYear} stroke="#ef4444" strokeDasharray="4 3"
              label={refLabel(`† ${p1DeathYear}`, '#ef4444')} />
            <ReferenceLine y={0} stroke="#ef4444" strokeWidth={1} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="mt-2 text-[11px] text-gray-500">
          Blå linje = median · Mörkt band = P25–P75 · Ljust band = P10–P90 · Avkastning µ={(p1inputs.returnRate * 100).toFixed(1)}%, σ=15% per år (ISK-schablonskatt avdragen).
          Arvsdelning och pensioner ingår i varje simulering.
        </p>
      </div>

      {/* Income sources chart */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-4 text-sm font-semibold text-gray-300">
          Inkomstkällor per år (kr/mån, nominellt)
          <InfoTip text="Hushållets nettoinkomst per år uppdelad på källa: bådas löner, pensioner och ISK-uttag, plus skatt. Vit linje = önskad utgift. Nominella belopp (ej inflationsjusterade till dagens värde)." />
        </h2>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={rows} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
            <XAxis dataKey="calYear" tick={<XTick />} height={24} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={tickStyle} width={40} />
            <Tooltip content={<TooltipIncome p1Name={p1Name} p2Name={p2Name} />} />
            <Legend wrapperStyle={{ fontSize: 11 }}
              formatter={(v) => <span style={{ color: '#9ca3af' }}>{v}</span>} />
            <Bar dataKey="p1WorkIncome" name={`${p1Name}s lön`} stackId="a" fill="#fb923c" />
            <Bar dataKey="p2WorkIncome" name={`${p2Name}s lön`} stackId="a" fill="#fbbf24" />
            <Bar dataKey="p1Pension" name={`${p1Name}s pension`} stackId="a" fill="#22c55e" />
            <Bar dataKey="p2Pension" name={`${p2Name}s pension`} stackId="a" fill="#14b8a6" />
            <Bar dataKey="p1IskMonthly" name={`${p1Name}s ISK`} stackId="a" fill="#3b82f6" />
            <Bar dataKey="p2IskMonthly" name={`${p2Name}s ISK`} stackId="a" fill="#6366f1" />
            <Bar dataKey="skatt" name="Skatt" stackId="a" fill="#ef4444" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
            <Line dataKey="spend" name="Önskad utgift" type="monotone"
              stroke="#ffffff" strokeWidth={1.5} strokeOpacity={0.7} dot={false} legendType="line" />
            {depletesRow && <ReferenceLine x={depletesRow.calYear} stroke="#ef4444" strokeWidth={2}
              label={refLabel(`⚠ ${depletesRow.calYear}`, '#ef4444')} />}
            <ReferenceLine x={p1FireYear} stroke="#f97316" strokeDasharray="4 3"
              label={refLabel(`🔥 ${p1FireYear}`, '#fb923c')} />
            <ReferenceLine x={p2FireYear} stroke="#14b8a6" strokeDasharray="4 3"
              label={refLabel(`🎉 ${p2FireYear}`, '#14b8a6')} />
            <ReferenceLine x={p1DeathYear} stroke="#ef4444" strokeDasharray="4 3"
              label={refLabel(`† ${p1DeathYear}`, '#ef4444')} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="mt-2 text-[11px] text-gray-500">
          Orange/Gul = löner · Grön/Teal = pensioner · Blå = {p1Name}s ISK · Indigo = {p2Name}s ISK · Röd = Skatt · Vit linje = önskad utgift
        </p>
      </div>

      {/* Key years table */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-300">Nyckelår
          <InfoTip text={`Utvald översikt vart femte år och vid viktiga händelser (FIRE-åldrar, ${p1Name}s bortgång, arvsår, ev. år då kapitalet tar slut). Visar inkomst, ISK-uttag, utgift och portföljvärde per person.`} />
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-2 pr-3">År</th>
                <th className="pb-2 pr-3">{p1Name[0]} / {p2Name[0]} ålder</th>
                <th className="pb-2 pr-3 text-right">{p1Name[0]} inkomst</th>
                <th className="pb-2 pr-3 text-right">{p2Name[0]} inkomst</th>
                <th className="pb-2 pr-3 text-right">{p1Name[0]} ISK</th>
                <th className="pb-2 pr-3 text-right">{p2Name[0]} ISK</th>
                <th className="pb-2 pr-3 text-right">Utgift</th>
                <th className="pb-2 pr-3 text-right">{p1Name[0]} portfölj</th>
                <th className="pb-2 text-right">{p2Name[0]} portfölj</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) =>
                  r.calYear % 5 === 0 ||
                  r.calYear === rows[0].calYear ||
                  r.calYear === p1FireYear ||
                  r.calYear === p2FireYear ||
                  r.calYear === p1DeathYear ||
                  r.calYear === p1DeathYear + 1 ||
                  r.calYear === p2DeathYear ||
                  (depletesRow && r.calYear === depletesRow.calYear)
                )
                .map((r) => {
                  const isP1Fire = r.calYear === p1FireYear
                  const isP2Fire = r.calYear === p2FireYear
                  const isDeath = r.calYear === p1DeathYear
                  const isPostDeath = r.calYear === p1DeathYear + 1
                  const isDepleted = depletesRow && r.calYear === depletesRow.calYear
                  const bg = isDepleted ? 'bg-red-950/30'
                    : isDeath || isPostDeath ? 'bg-red-950/20'
                    : isP1Fire || isP2Fire ? 'bg-teal-950/20'
                    : ''
                  const cIncome = r.p1Working ? r.p1WorkIncome : r.p1Pension
                  const sIncome = r.p2Working ? r.p2WorkIncome : r.p2Pension
                  return (
                    <tr key={r.calYear} className={`border-t border-border ${bg}`}>
                      <td className="py-1.5 pr-3 font-medium text-gray-300">
                        {r.calYear}
                        {isDeath && <span className="ml-1 text-red-400">†</span>}
                        {isPostDeath && <span className="ml-1 text-amber-400">arv</span>}
                        {isP1Fire && <span className="ml-1">🔥</span>}
                        {isP2Fire && !isP1Fire && <span className="ml-1">🎉</span>}
                        {isDepleted && <span className="ml-1 text-red-400">⚠</span>}
                      </td>
                      <td className="py-1.5 pr-3 text-gray-400">
                        {r.p1Alive ? r.p1Age : '†'} / {r.p2Alive ? r.p2Age : '†'}
                      </td>
                      <td className={`py-1.5 pr-3 text-right ${r.p1Working ? 'text-orange-400' : 'text-green-400'}`}>
                        {r.p1Alive ? formatKr(Math.round(cIncome)) : '–'}
                      </td>
                      <td className={`py-1.5 pr-3 text-right ${r.p2Working ? 'text-yellow-400' : 'text-teal-400'}`}>
                        {r.p2Alive ? formatKr(Math.round(sIncome)) : '–'}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-blue-400">
                        {r.p1IskMonthly > 0 ? formatKr(Math.round(r.p1IskMonthly)) : '–'}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-indigo-400">
                        {r.p2IskMonthly > 0 ? formatKr(Math.round(r.p2IskMonthly)) : '–'}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-gray-300">
                        {formatKr(Math.round(r.spend))}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-orange-400">
                        {isPostDeath ? <span className="text-amber-400">{fmtM(r.capitalP2 - (atP1Death?.capitalP1 ?? 0) * survivorFraction)}</span> : fmtM(r.capitalP1)}
                      </td>
                      <td className={`py-1.5 text-right ${r.capitalP2 > 0 ? 'text-teal-400' : 'text-red-400'}`}>
                        {fmtM(r.capitalP2)}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
        {inheritedByChild > 0 && (
          <p className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
            Vid {p1Name}s bortgång ({p1DeathYear}) ärvde barnet {fmtM(inheritedByChild)} ({Math.round((1 - survivorFraction) * 100)}% av portföljen på {fmtM(atP1Death?.capitalP1)}). {p2Name} fick {fmtM((atP1Death?.capitalP1 ?? 0) * survivorFraction)} ({Math.round(survivorFraction * 100)}%).
          </p>
        )}
      </div>

      {/* ── Avancerad analys (utfällbar) ───────────────────────────────────── */}
      <details className="group space-y-6 [&[open]>summary]:mb-2">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-gray-300">
          <span>🔬 Avancerad Monte Carlo-analys (spaghetti, histogram, heatmap)</span>
          <span className="text-[11px] font-normal text-gray-500">
            <span className="group-open:hidden">visa ▸</span>
            <span className="hidden group-open:inline">dölj ▾</span>
          </span>
        </summary>

      {/* ── 2. Spaghetti-plot ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-300">2. Spaghetti-plot — 100 enskilda banor
          <InfoTip text="100 slumpvis utvalda simuleringsbanor, en linje per möjligt utfall. Visar hur mycket banorna spretar över tid och var de kraschar (når noll). Ger en känsla för osäkerheten bortom percentilbanden." />
        </h2>
        <p className="mb-3 text-[11px] text-gray-500">Varje linje är ett möjligt utfall. Man ser hur banorna spretar och var de kraschar.</p>
        {mc.samplePaths && <SpaghettiPlot samplePaths={mc.samplePaths} ages={mc.calYears} maxCap={mc.maxCap} />}
      </div>

      {/* ── 3. Histogram vid slutåret ──────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-300">3. Histogram — kapital år {mc.endYear}
          <InfoTip text="Fördelningen av slutkapitalet över alla simuleringar. Staplarnas höjd = andel simuleringar som landade i respektive kapitalintervall. Grön linje markerar medianen." />
        </h2>
        <p className="mb-3 text-[11px] text-gray-500">Fördelning av slutkapital över alla {mc.sims?.toLocaleString('sv-SE')} simuleringar. Visar hur sannolika olika utfall är.</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart
            data={histogram.data}
            margin={{ top: 4, right: 16, bottom: 0, left: 24 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 10 }} interval={4} unit=" Mkr" />
            <YAxis tick={tickStyle} width={36} tickFormatter={v => `${v.toFixed(0)}%`} />
            <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Andel simuleringar']} labelFormatter={l => `~${l} Mkr`}
              contentStyle={{ background: '#1a1a1a', border: '1px solid #333', fontSize: 11 }} />
            <Bar dataKey="pct" fill="#3b82f6" fillOpacity={0.8} radius={[2, 2, 0, 0]} name="Andel" />
            {histogram.medianLabel != null && (
              <ReferenceLine x={histogram.medianLabel} stroke="#22c55e" strokeDasharray="4 3"
                label={refLabel('Median', '#22c55e')} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── 4. Heatmap / densitetskarta ────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-300">4. Heatmap — sannolikhetstäthet per år
          <InfoTip text="Densitetskarta över tid: mörkare blå = fler simuleringar landade på den kapitalnivån det året. Visar var portföljerna koncentreras och hur spridningen växer framåt." />
        </h2>
        <p className="mb-3 text-[11px] text-gray-500">Mörkare blå = fler simuleringar landade på den kapitalsnivån det året. Visar var portföljerna koncentreras över tid.</p>
        <HeatmapChart heatmapData={mc.heatmapData} bucketSize={mc.bucketSize} BUCKETS={mc.BUCKETS} />
      </div>
      </details>

      {/* ── 5. Success rate per utgiftsnivå ────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-300">5. Success rate vs. månadsutgift
          <InfoTip text="Sannolikheten att pengarna räcker hela livet vid olika månadsutgifter (1 000 simuleringar per nivå). Orange linje = ert nuläge, grön = 90 %-tröskeln." />
        </h2>
        <p className="mb-3 text-[11px] text-gray-500">Hur mycket förändras sannolikheten att pengarna räcker beroende på hushållets utgifter? 1 000 sim per nivå.</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={spendSensitivity} margin={{ top: 4, right: 16, bottom: 0, left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
            <XAxis dataKey="spend" tick={{ fill: '#6b7280', fontSize: 10 }}
              tickFormatter={v => `${(v / 1000).toFixed(0)}k`} unit=" kr" />
            <YAxis tick={tickStyle} width={36} domain={[0, 100]} tickFormatter={v => `${v}%`} />
            <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Success rate']}
              labelFormatter={v => `${formatKr(v)}/mån`}
              contentStyle={{ background: '#1a1a1a', border: '1px solid #333', fontSize: 11 }} />
            <ReferenceLine x={hhSpend} stroke="#f97316" strokeDasharray="4 3"
              label={refLabel('Nuläge', '#f97316')} />
            <ReferenceLine y={90} stroke="#22c55e" strokeDasharray="4 3"
              label={refLabel('90%', '#22c55e', 'end', -4)} />
            <Line type="monotone" dataKey="successRate" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} name="Success rate" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── 6. Percentil-tabell ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-300">6. Percentiltabell — nyckelår
          <InfoTip text="Spridningen i Monte Carlo-utfallet per nyckelår. P10 = pessimistiskt (bara 10 % blev sämre), P50 = median, P90 = optimistiskt. Visar hur stor osäkerheten är." />
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-2 pr-3">År</th>
                <th className="pb-2 pr-3 text-right">P10</th>
                <th className="pb-2 pr-3 text-right">P25</th>
                <th className="pb-2 pr-3 text-right text-blue-300">P50 (median)</th>
                <th className="pb-2 pr-3 text-right">P75</th>
                <th className="pb-2 text-right">P90</th>
              </tr>
            </thead>
            <tbody>
              {mc.fan?.filter(r =>
                r.calYear % 5 === 0 ||
                r.calYear === p1FireYear ||
                r.calYear === p2FireYear ||
                r.calYear === p1DeathYear ||
                r.calYear === mc.endYear
              ).map(r => (
                <tr key={r.calYear} className="border-t border-border">
                  <td className="py-1.5 pr-3 font-medium text-gray-300">
                    {r.calYear}
                    {r.calYear === p1FireYear && ' 🔥'}
                    {r.calYear === p2FireYear && ' 🎉'}
                    {r.calYear === p1DeathYear && ' †'}
                    {r.calYear === mc.endYear && ' (slut)'}
                  </td>
                  {[r.p10, r.p25, r.p50, r.p75, r.p90].map((v, i) => (
                    <td key={i} className={`py-1.5 pr-3 text-right ${v <= 0 ? 'text-red-400' : i === 2 ? 'text-blue-300' : 'text-gray-300'}`}>
                      {v <= 0 ? '0' : fmtM(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-gray-500">P10 = pessimistiskt, P50 = median, P90 = optimistiskt. Baserat på {mc.sims?.toLocaleString('sv-SE')} simuleringar.</p>
      </div>

      <footer className="pb-8 pt-2 text-xs text-gray-500">
        Hushållssimuleringen visar separata ISK-portföljer från idag till {p2Name}s {p2inputs.lifeExpectancy}-årsdag. Löner, arvsdelning och avkastningsantagande läses från config-filen. Skatt på lön beräknas med jobbskatteavdrag (inkl. statlig skatt). Pensionsskatt enligt grundavdrag 2025 (förhöjt från 67). ISK-schablonskatt dras av i framskrivningen.
      </footer>
    </div>
  )
}
