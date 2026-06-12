import React, { useMemo } from 'react'
import { fixedReturnScenarios, formatKr, formatMkr } from '../calculations.js'
import InfoTip from './InfoTip.jsx'

export default function ReturnScenariosTable({ inputs, schedule }) {
  const rows = useMemo(
    () => fixedReturnScenarios(inputs, schedule),
    [inputs, schedule]
  )

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-1 text-sm font-semibold text-gray-200">
        Fasta avkastningsscenarier
        <InfoTip text="Deterministiskt slutkapital vid livslängdens slut om avkastningen vore exakt så här hög varje år (ISK-skatt avdragen). Visar hur känslig planen är för långsiktig avkastning — utan slumpens spridning." />
      </h3>
      <p className="mb-3 text-xs text-gray-500">
        Slutkapital vid {inputs.lifeExpectancy} per antagen årlig avkastning. Markerad rad
        = din nuvarande avkastning.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-gray-400">
              <th className="px-2 py-1 text-left">Avkastning</th>
              <th className="px-2 py-1 text-right">Kapital vid FIRE</th>
              <th className="px-2 py-1 text-right">Totalt uttaget</th>
              <th className="px-2 py-1 text-right">Slutkapital</th>
              <th className="px-2 py-1 text-right">Utfall</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const current = Math.abs(row.rate - inputs.returnRate) < 0.0026
              return (
                <tr
                  key={row.rate}
                  className="border-t border-border"
                  style={
                    current
                      ? { outline: '2px solid #f97316', outlineOffset: '-2px' }
                      : undefined
                  }
                >
                  <td className="px-2 py-1 font-medium text-gray-200">
                    {(row.rate * 100).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}%
                  </td>
                  <td className="px-2 py-1 text-right text-gray-300" title={formatKr(row.capitalAtFire)}>
                    {formatMkr(row.capitalAtFire)}
                  </td>
                  <td className="px-2 py-1 text-right text-gray-300" title={formatKr(row.totalWithdrawn)}>
                    {formatMkr(row.totalWithdrawn)}
                  </td>
                  <td
                    className="px-2 py-1 text-right font-semibold"
                    style={{ color: row.depleted ? '#ef4444' : '#22c55e' }}
                    title={formatKr(row.portfolioAt90)}
                  >
                    {formatMkr(row.portfolioAt90)}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {row.depleted ? (
                      <span className="text-fire-red">Tar slut vid {row.depletedAge}</span>
                    ) : (
                      <span className="text-fire-green">Räcker</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
