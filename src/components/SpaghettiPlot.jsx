import React from 'react'

export default function SpaghettiPlot({ samplePaths, ages, maxCap, labelKey = 'age' }) {
  if (!samplePaths?.length || !ages?.length) return null
  const W = 800, H = 280
  const ml = 52, mr = 16, mt = 8, mb = 28
  const pw = W - ml - mr, ph = H - mt - mb
  const cx = (i) => ml + (i / Math.max(1, ages.length - 1)) * pw
  const cy = (cap) => mt + ph - Math.min(1, Math.max(0, cap / maxCap)) * ph
  const yTicks = [0, 0.25, 0.5, 0.75, 1]
  const labelAges = ages.filter(a => a % 5 === 0)

  return (
    <div style={{ width: '100%', height: H }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <line x1={ml} y1={mt} x2={ml} y2={mt + ph} stroke="#374151" strokeWidth="1" />
        <line x1={ml} y1={mt + ph} x2={ml + pw} y2={mt + ph} stroke="#374151" strokeWidth="1" />
        {yTicks.map(f => {
          const yp = mt + ph - f * ph
          return (
            <g key={f}>
              <line x1={ml - 3} y1={yp} x2={ml + pw} y2={yp} stroke="#1f2937" strokeWidth="1" />
              <text x={ml - 5} y={yp + 4} textAnchor="end" fill="#6b7280" fontSize="10">
                {(f * maxCap / 1e6).toFixed(0)}
              </text>
            </g>
          )
        })}
        {labelAges.map(a => {
          const xi = ages.indexOf(a)
          if (xi < 0) return null
          const xp = cx(xi)
          return (
            <g key={a}>
              <line x1={xp} y1={mt + ph} x2={xp} y2={mt + ph + 4} stroke="#374151" strokeWidth="1" />
              <text x={xp} y={mt + ph + 16} textAnchor="middle" fill="#6b7280" fontSize="10">{a}</text>
            </g>
          )
        })}
        <text x={10} y={H / 2} textAnchor="middle" fill="#6b7280" fontSize="10"
          transform={`rotate(-90,10,${H / 2})`}>Mkr</text>
        {samplePaths.map((path, i) => (
          <path key={i}
            d={path.map((cap, yi) => `${yi === 0 ? 'M' : 'L'}${cx(yi).toFixed(1)},${cy(cap).toFixed(1)}`).join(' ')}
            stroke="#3b82f6" strokeWidth="0.8" strokeOpacity="0.18" fill="none" />
        ))}
      </svg>
    </div>
  )
}
