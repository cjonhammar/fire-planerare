import React, { useMemo } from 'react'
import { sustainabilityScenarios, formatKr } from '../calculations.js'
import InfoTip from './InfoTip.jsx'

export default function SustainabilityTable({ inputs, schedule }) {
  const scenarios = useMemo(
    () => sustainabilityScenarios(inputs, schedule),
    [inputs, schedule]
  )

  // Color scale for ISK withdrawal cells (darker = higher)
  const maxIsk = Math.max(
    1,
    ...scenarios.flatMap((s) => s.perPhaseAvg.map((b) => b.avgIsk))
  )
  const iskColor = (v) => {
    const t = Math.min(1, v / maxIsk)
    const alpha = 0.1 + t * 0.5
    return `rgba(59, 130, 246, ${alpha})`
  }

  const phaseLabels = scenarios[0]?.perPhaseAvg.map((b) => b.label) ?? []

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-1 text-sm font-semibold text-gray-200">
        Hållbarhet — fasmodell (snitt ISK-uttag/år)
        <InfoTip text="Genomsnittligt faktiskt ISK-uttag per livsfas (kapat till tillgängligt kapital — du kan inte ta ut mer än portföljen rymmer), plus utfall vid livslängdens slut, per avkastningsscenario. Grönt = kvarvarande portfölj, rött = pengarna tar slut (ålder visas). I underskottsscenarier blir uttaget och totalen lägre eftersom kontot töms." />
      </h3>
      <p className="mb-3 text-xs text-gray-500">
        Genomsnittligt ISK-uttag per fas och portfölj vid {inputs.lifeExpectancy} per
        avkastningsscenario.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-gray-400">
              <th className="px-2 py-1 text-left">Avkastning</th>
              {phaseLabels.map((l) => (
                <th key={l} className="px-2 py-1 text-right">
                  {l}
                </th>
              ))}
              <th className="px-2 py-1 text-right">Totalt uttaget</th>
              <th className="px-2 py-1 text-right">Utfall vid {inputs.lifeExpectancy}</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={s.key} className="border-t border-border">
                <td className="px-2 py-1 font-medium text-gray-200">
                  {s.label} ({(s.r * 100).toFixed(0)}%)
                </td>
                {s.perPhaseAvg.map((b, i) => (
                  <td
                    key={i}
                    className="px-2 py-1 text-right text-gray-200"
                    style={{ background: iskColor(b.avgIsk) }}
                  >
                    {(b.avgIsk / 1000).toFixed(0)}k
                  </td>
                ))}
                <td className="px-2 py-1 text-right text-gray-300">
                  {(s.totalWithdrawn / 1_000_000).toFixed(1)}M
                </td>
                <td
                  className="px-2 py-1 text-right font-semibold"
                  style={{ color: s.depleted ? '#ef4444' : '#22c55e' }}
                  title={s.depleted ? `Tar slut vid ${s.depletedAge} år` : formatKr(s.portfolioAt90)}
                >
                  {s.depleted
                    ? `Tar slut ${s.depletedAge}`
                    : `${(s.portfolioAt90 / 1_000_000).toFixed(2)}M`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
