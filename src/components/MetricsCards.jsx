import React, { useMemo } from 'react'
import { summary, formatKr, formatMkr } from '../calculations.js'
import InfoTip from './InfoTip.jsx'

function Card({ title, value, sub, accent, info }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between text-xs uppercase tracking-wide text-gray-400">
        <span>{title}</span>
        {info && <InfoTip text={info} />}
      </div>
      <div
        className="mt-2 text-2xl font-bold"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  )
}

export default function MetricsCards({ inputs, schedule, mc }) {
  const s = useMemo(() => summary(inputs, schedule), [inputs, schedule])

  const coverageColor =
    s.coverageRatio > 1.5 ? '#22c55e' : s.coverageRatio > 1.0 ? '#f59e0b' : '#ef4444'
  const successColor =
    mc.successRate > 90 ? '#22c55e' : mc.successRate > 75 ? '#f59e0b' : '#ef4444'
  const medianColor = mc.medianAt90 > 0 ? '#22c55e' : '#ef4444'

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card
        title="FIRE-nummer (PV)"
        value={formatKr(s.fireNumber)}
        sub="nuvärde av faktiska uttag"
        info="Nuvärdet av alla framtida ISK-uttag, diskonterat med din nettoavkastning (avkastning minus ISK-schablonskatt). Beror på avkastningen: högre avkastning ger lägre FIRE-nummer."
      />
      <Card
        title="Täckningsgrad"
        value={`${s.coverageRatio.toFixed(2)}×`}
        accent={coverageColor}
        sub={
          s.coverageRatio >= 1
            ? 'Kapitalet räcker'
            : 'Under FIRE-nummer'
        }
        info="Kapital vid FIRE delat med FIRE-numret. ≥ 1,0 betyder att kapitalet räcker till hela uttagsplanen."
      />
      <Card
        title={`Kapital vid FIRE (${inputs.fireAge})`}
        value={formatKr(s.capitalAtFire)}
        info="Ditt fria kapital (ISK + PP) framskrivet med nettoavkastning och månadssparande fram till FIRE-åldern."
      />
      <Card
        title="Monte Carlo lyckas"
        value={`${mc.successRate.toFixed(1)}%`}
        accent={successColor}
        sub={`${mc.sims.toLocaleString('sv-SE')} sim · µ=${(inputs.returnRate * 100).toFixed(1)}%`}
        info="Andel av simuleringarna där pengarna räcker hela livet, med slumpmässig årsavkastning (µ = din avkastning, σ = 15 %, ISK-skatt avdragen)."
      />
      <Card
        title="Trinity 25× (4% SWR)"
        value={formatKr(s.trinity25x)}
        sub={`25 × ${formatKr(s.annualSpendAtFire)}/år`}
        info="Tumregel enligt Trinity-studien: målbelopp = 25 × årsutgiften (4 % årligt uttag). Oberoende av avkastningsantagandet."
      />
      <Card
        title="Konservativ 3,5% SWR"
        value={formatKr(s.trinity35)}
        sub="≈ 28,6 × årsutgift"
        info="Försiktigare mål: ~28,6 × årsutgiften (3,5 % uttag) för extra säkerhetsmarginal. Oberoende av avkastningen."
      />
      <Card
        title={`Median portfölj vid ${inputs.lifeExpectancy}`}
        value={formatMkr(mc.medianAt90)}
        accent={medianColor}
        info="Mittenutfallet (P50) av kapitalet vid livslängdens slut, över alla Monte Carlo-simuleringar."
      />
      <Card
        title="ISK-skatt/år"
        value={formatKr(s.iskTaxPerYear)}
        sub="schablonskatt ≈ 1,065% (avdragen)"
        info="Ungefärlig schablonskatt på fritt kapital i år (≈ 1,065 % av kapitalet, 2026 års sats; fribeloppet 300 tkr/person ignoreras konservativt). Dras av i alla framskrivningar."
      />
    </div>
  )
}
