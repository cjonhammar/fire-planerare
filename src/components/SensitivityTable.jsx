import React, { useMemo } from 'react'
import { sensitivityGrid, formatKr } from '../calculations.js'
import InfoTip from './InfoTip.jsx'

export default function SensitivityTable({ inputs }) {
  const grid = useMemo(() => sensitivityGrid(inputs), [inputs])
  const freeCapital = inputs.iskValue + inputs.ppValue

  const cellColor = (fn) => {
    if (fn <= freeCapital) return { bg: '#14532d', fg: '#c8e6c9' } // green
    if (fn <= freeCapital * 1.5) return { bg: '#713f12', fg: '#fff9c4' } // yellow
    return { bg: '#7f1d1d', fg: '#ffcdd2' } // red
  }

  const compact = (v) =>
    (v / 1_000_000).toLocaleString('sv-SE', { maximumFractionDigits: 1 }) + 'M'

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-1 text-sm font-semibold text-gray-200">
        Känslighetsanalys — FIRE-nummer
        <InfoTip text="FIRE-numret (kapital som krävs vid FIRE) för olika kombinationer av månadsutgift (rader) och avkastning (kolumner). Grönt = under ditt fria kapital, rött = mer än 1,5× kapitalet. Orange ram = din nuvarande inställning." />
      </h3>
      <p className="mb-3 text-xs text-gray-500">
        Rader: önskat månadsbelopp · Kolumner: avkastning. Markerad ruta = nuvarande
        inställning.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-surface px-2 py-1 text-left text-gray-400">
                kr/mån
              </th>
              {grid.rates.map((r) => (
                <th key={r} className="px-2 py-1 text-center text-gray-400">
                  {(r * 100).toFixed(0)}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => {
              const spendMatch =
                Math.abs(row.spend - inputs.desiredSpend) < 2500
              return (
                <tr key={row.spend}>
                  <td className="sticky left-0 bg-surface px-2 py-1 text-gray-300">
                    {(row.spend / 1000).toFixed(0)}k
                  </td>
                  {row.cells.map((cell) => {
                    const c = cellColor(cell.fireNumber)
                    const rateMatch =
                      Math.abs(cell.rate - inputs.returnRate) < 0.0026
                    const highlight = spendMatch && rateMatch
                    return (
                      <td
                        key={cell.rate}
                        title={formatKr(cell.fireNumber)}
                        className="px-2 py-1 text-center"
                        style={{
                          background: c.bg,
                          color: c.fg,
                          outline: highlight ? '2px solid #f97316' : 'none',
                          outlineOffset: '-2px',
                          fontWeight: highlight ? 700 : 400,
                        }}
                      >
                        {compact(cell.fireNumber)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-gray-400">
        <LegendSwatch bg="#14532d" label="≤ fritt kapital" />
        <LegendSwatch bg="#713f12" label="≤ 1,5× kapital" />
        <LegendSwatch bg="#7f1d1d" label="> 1,5× kapital" />
      </div>
    </div>
  )
}

function LegendSwatch({ bg, label }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={{ background: bg }}
      />
      {label}
    </span>
  )
}
