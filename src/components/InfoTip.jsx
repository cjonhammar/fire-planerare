import React, { useState } from 'react'

// Liten ⓘ-ikon som visar en förklaringstext vid hover eller klick.
// Tooltipen växer åt vänster (right-0) så den sällan klipps vid högerkanten.
export default function InfoTip({ text }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative ml-1 inline-flex align-middle">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label="Mer information"
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-gray-600 text-[9px] font-semibold leading-none text-gray-400 hover:border-fire-orange hover:text-fire-orange focus:outline-none"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute right-0 top-5 z-50 w-60 rounded-md border border-border bg-bg px-3 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-gray-300 shadow-xl"
        >
          {text}
        </span>
      )}
    </span>
  )
}
