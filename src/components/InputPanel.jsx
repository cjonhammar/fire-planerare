import React, { useState } from 'react'
import { formatKr } from '../calculations.js'

function Section({ icon, title, children }) {
  return (
    <div className="border-b border-border px-4 py-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300">
        <span>{icon}</span>
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function NumberField({ label, value, onChange, step = 1, suffix }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-gray-400">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          step={step}
          onChange={(e) => {
            // Halvfärdig inmatning ("-", "1e") ger NaN som annars sprids in i
            // alla beräkningar — behandla som 0 tills värdet är giltigt.
            const v = Number(e.target.value)
            onChange(Number.isFinite(v) ? v : 0)
          }}
          className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-gray-100 focus:border-fire-orange focus:outline-none"
        />
        {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
      </div>
    </label>
  )
}

function ReadOnlyField({ label, value }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-400">{label}</span>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        title={revealed ? 'Dölj — klicka för att dölja' : 'Dolt — klicka för att visa'}
        className="font-medium text-gray-200 hover:text-fire-orange focus:outline-none"
      >
        {revealed ? (
          <span className="text-sm">{value}</span>
        ) : (
          <span className="text-sm tracking-widest text-gray-500">••••••</span>
        )}
      </button>
    </div>
  )
}

// Read-only lista över konton från config. Kontonamn (+ ev. typtagg) visas
// alltid; belopp + summa är dolda tills man klickar Visa (samma sekretess-
// mönster som ReadOnlyField). Endast konton som finns i config renderas (max 10).
function IskAccounts({ accounts, total }) {
  const [revealed, setRevealed] = useState(false)
  const mask = (v, dots = '••••••') =>
    revealed ? formatKr(v, { suffix: ' kr' }) : <span className="tracking-widest text-gray-500">{dots}</span>
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Konton ({accounts.length})</span>
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="text-[11px] text-gray-500 hover:text-fire-orange focus:outline-none"
        >
          {revealed ? 'Dölj' : 'Visa'}
        </button>
      </div>
      <ul className="space-y-1">
        {accounts.map((a, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 truncate text-gray-300" title={a.name}>
                {a.name}
              </span>
              {a.type && a.type !== 'ISK' && (
                <span className="shrink-0 rounded bg-fire-orange/15 px-1 text-[9px] font-semibold uppercase text-fire-orange">
                  {a.type}
                </span>
              )}
            </span>
            <span className="shrink-0 font-medium text-gray-200">{mask(a.value, '••••')}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-border pt-1.5 text-xs">
        <span className="font-semibold text-gray-300">Summa</span>
        <span className="font-semibold text-fire-orange">{mask(total)}</span>
      </div>
    </div>
  )
}

function PercentField({ label, value, onChange, min = 0, max = 0.15, step = 0.005 }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="text-gray-300">{(value * 100).toFixed(2)}%</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  )
}

function ScheduleSection({ schedule, setOverride, resetSchedule }) {
  const overrideCount = schedule.filter((r) => r.overridden).length
  return (
    <details className="group border-b border-border px-4 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-gray-300">
        <span className="flex items-center gap-2">
          <span>📅</span> Plan per år
          {overrideCount > 0 && (
            <span className="rounded-full bg-fire-orange/15 px-1.5 text-[10px] font-normal text-fire-orange">
              {overrideCount} ändrade
            </span>
          )}
        </span>
        <span className="text-[11px] font-normal text-gray-500">
          <span className="group-open:hidden">visa ▸</span>
          <span className="hidden group-open:inline">dölj ▾</span>
        </span>
      </summary>
      <div className="mb-2 mt-3 flex justify-end">
        <button
          onClick={resetSchedule}
          className="rounded-md border border-border px-2 py-0.5 text-[11px] text-gray-400 hover:text-gray-100"
        >
          Återställ schema
        </button>
      </div>
      <div className="grid grid-cols-[2.2rem_1fr_1fr] items-center gap-1.5 text-[10px] text-gray-500">
        <span>Ålder</span>
        <span className="text-right">Önskat kr/mån</span>
        <span className="text-right">Extra kr/år</span>
      </div>
      <div className="mt-1 max-h-72 space-y-1 overflow-y-auto pr-1">
        {schedule.map((row) => (
          <div
            key={row.age}
            className="grid grid-cols-[2.2rem_1fr_1fr] items-center gap-1.5"
          >
            <span
              className={`text-xs ${
                row.overridden ? 'font-semibold text-fire-orange' : 'text-gray-400'
              }`}
            >
              {row.age}
            </span>
            <input
              type="number"
              step={1000}
              value={Math.round(row.spend)}
              onChange={(e) => setOverride(row.age, { spend: Number(e.target.value) })}
              className="w-full rounded border border-border bg-bg px-1.5 py-1 text-right text-xs text-gray-100 focus:border-fire-orange focus:outline-none"
            />
            <input
              type="number"
              step={10000}
              value={Math.round(row.extra)}
              onChange={(e) => setOverride(row.age, { extra: Number(e.target.value) })}
              className="w-full rounded border border-border bg-bg px-1.5 py-1 text-right text-xs text-gray-100 focus:border-fire-orange focus:outline-none"
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-gray-500">
        Belopp i nominella kronor för respektive år. Orange = manuellt ändrat år.
        Extra uttag tas från ISK utöver månadsbeloppet.
      </p>
    </details>
  )
}

export default function InputPanel({
  inputs,
  update,
  reset,
  schedule,
  setOverride,
  resetSchedule,
  stiftelseConfigured = false,
}) {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-gray-300">Inställningar</span>
        <button
          onClick={reset}
          className="rounded-md border border-border px-2 py-1 text-xs text-gray-400 hover:text-gray-100"
        >
          Återställ
        </button>
      </div>

      <Section icon="👤" title="Personuppgifter">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Födelseår"
            value={inputs.birthYear}
            onChange={(v) => update({ birthYear: v })}
          />
          <NumberField
            label="Födelsemånad (1–12)"
            value={inputs.birthMonth}
            onChange={(v) => update({ birthMonth: Math.min(12, Math.max(1, v)) })}
          />
        </div>
        <p className="text-[11px] text-gray-500">
          Nuvarande ålder: {inputs.currentAge} år
        </p>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="FIRE-ålder (år)"
            value={inputs.fireAge}
            onChange={(v) => update({ fireAge: v })}
          />
          <NumberField
            label="FIRE-ålder (mån)"
            value={inputs.fireAgeMonths ?? 0}
            onChange={(v) => update({ fireAgeMonths: Math.min(11, Math.max(0, v)) })}
          />
        </div>
        <p className="text-[11px] text-gray-500">
          FIRE-datum:{' '}
          {(() => {
            const totalM =
              inputs.birthYear * 12 + (inputs.birthMonth - 1) +
              inputs.fireAge * 12 + (inputs.fireAgeMonths ?? 0)
            const y = Math.floor(totalM / 12)
            const m = totalM % 12
            const names = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec']
            return `${names[m]} ${y}`
          })()}
        </p>
        <NumberField
          label="Förväntad livslängd"
          value={inputs.lifeExpectancy}
          onChange={(v) => update({ lifeExpectancy: v })}
        />
      </Section>

      <Section icon="💼" title="Lön (pre-FIRE)">
        <ReadOnlyField
          label="Bruttolön"
          value={formatKr(inputs.grossSalary ?? 0, { suffix: ' kr/mån' })}
        />
        <p className="text-[11px] text-gray-500">
          Läses från config-filen. Nettolön visas i inkomstdiagrammet,
          inflationsjusterat per år.
        </p>
      </Section>

      <Section icon="💰" title="Portfölj">
        {inputs.iskAccounts?.length > 0 ? (
          <IskAccounts accounts={inputs.iskAccounts} total={inputs.iskValue} />
        ) : (
          <NumberField
            label="ISK-värde"
            value={inputs.iskValue}
            step={10000}
            suffix="kr"
            onChange={(v) => update({ iskValue: v })}
          />
        )}
        <NumberField
          label="Pensionskapital (PP)"
          value={inputs.ppValue}
          step={10000}
          suffix="kr"
          onChange={(v) => update({ ppValue: v })}
        />
        <NumberField
          label="Månadssparande"
          value={inputs.monthlySavings}
          step={500}
          suffix="kr"
          onChange={(v) => update({ monthlySavings: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Från ålder"
            value={inputs.monthlySavingsFrom}
            onChange={(v) => update({ monthlySavingsFrom: v })}
          />
          <NumberField
            label="Till ålder"
            value={inputs.monthlySavingsTo}
            onChange={(v) => update({ monthlySavingsTo: v })}
          />
        </div>
        <PercentField
          label="Avkastning (nominell)"
          value={inputs.returnRate}
          onChange={(v) => update({ returnRate: v })}
        />
        <PercentField
          label="Inflation"
          value={inputs.inflation}
          onChange={(v) => update({ inflation: v })}
        />
      </Section>

      <Section icon="🛒" title="Önskad levnadskostnad">
        <NumberField
          label="Önskad utgift (dagens köpkraft)"
          value={inputs.desiredSpend}
          step={1000}
          suffix="kr/mån"
          onChange={(v) => update({ desiredSpend: v })}
        />
        <ReadOnlyField
          label="Önskat arv (target estate)"
          value={formatKr(inputs.targetEstate ?? 0)}
        />
        <p className="text-[11px] leading-snug text-gray-500">
          Beloppet anges i dagens köpkraft och räknas upp
          +{(inputs.inflation * 100).toFixed(0)}% per år från idag. Det seedar
          tabellen nedan — ändra valfritt år där.
        </p>
      </Section>

      <ScheduleSection
        schedule={schedule}
        setOverride={setOverride}
        resetSchedule={resetSchedule}
      />

      <Section icon="🏦" title="Pension (brutto/mån)">
        <NumberField
          label="Tjänstepension 55–64"
          value={inputs.tjänstepension55_64}
          step={500}
          suffix="kr"
          onChange={(v) => update({ tjänstepension55_64: v })}
        />
        <NumberField
          label="Tjänstepension 65+"
          value={inputs.tjänstepension65plus}
          step={500}
          suffix="kr"
          onChange={(v) => update({ tjänstepension65plus: v })}
        />
        <NumberField
          label="Allmän pension 65+"
          value={inputs.allmänPension65plus}
          step={500}
          suffix="kr"
          onChange={(v) => update({ allmänPension65plus: v })}
        />
        <NumberField
          label="Nordnet privat 55–64"
          value={inputs.nordnetPrivat55_64}
          step={100}
          suffix="kr"
          onChange={(v) => update({ nordnetPrivat55_64: v })}
        />
        <PercentField
          label="Kommunalskatt + landsting"
          value={inputs.kommunRate}
          onChange={(v) => update({ kommunRate: v })}
          min={0.25}
          max={0.40}
          step={0.0001}
        />
        <p className="text-[11px] leading-snug text-gray-500">
          Grundavdrag beräknas automatiskt (SKV 2025). Förhöjt grundavdrag
          tillämpas från 67 år. Alla pensioner anges i dagens köpkraft och
          indexeras med inflationen från idag (minPension-beloppen är reala).
        </p>
      </Section>

      {/* Visas om stiftelse finns i config ELLER har ett värde — annars skulle
          sektionen försvinna permanent så fort man skriver 0 i värdefältet. */}
      {(inputs.stiftelseValue > 0 || stiftelseConfigured) && <Section icon="🏢" title={inputs.stiftelseName || 'Stiftelse'}>
        <p className="text-[11px] leading-snug text-gray-500">
          Engångskapital som betalas ut som annuitet mellan start- och stopp-ålder.
          Namnet sätts via <code>stiftelseName</code> i config.
        </p>
        <NumberField
          label="Nuvarande värde"
          value={inputs.stiftelseValue}
          step={1000}
          suffix="kr"
          onChange={(v) => update({ stiftelseValue: v })}
        />
        <PercentField
          label="Tillväxttakt"
          value={inputs.stiftelseRate}
          onChange={(v) => update({ stiftelseRate: v })}
          min={0}
          max={0.12}
          step={0.005}
        />
        <NumberField
          label="Uttag från ålder"
          value={inputs.stiftelseStartAge}
          onChange={(v) => update({ stiftelseStartAge: v })}
        />
        <NumberField
          label="Uttag till ålder"
          value={inputs.stiftelseEndAge}
          onChange={(v) => update({ stiftelseEndAge: v })}
        />
      </Section>}

      <Section icon="💼" title={inputs.extraWorkName || 'Extrajobb'}>
        <p className="text-[11px] leading-snug text-gray-500">
          Extra arbetsinkomst (brutto kr/mån) mellan start- och stopp-ålder.
          Inflationsuppräknas och lönebeskattas (jobbskatteavdrag). Sätt 0 för
          inget extrajobb. Namnet sätts via <code>extraWorkName</code> i config.
        </p>
        <NumberField
          label="Bruttolön"
          value={inputs.extraWorkMonthly}
          step={1000}
          suffix="kr/mån"
          onChange={(v) => update({ extraWorkMonthly: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Från ålder"
            value={inputs.extraWorkStartAge}
            onChange={(v) => update({ extraWorkStartAge: v })}
          />
          <NumberField
            label="Till ålder"
            value={inputs.extraWorkEndAge}
            onChange={(v) => update({ extraWorkEndAge: v })}
          />
        </div>
      </Section>

      <div className="px-4 py-4 text-[11px] leading-relaxed text-gray-500">
        Fritt kapital: {formatKr(inputs.iskValue + inputs.ppValue)}
      </div>
    </div>
  )
}
