import React, { useMemo, useState, useEffect } from 'react'
import { defaults, partnerDefaults, monteCarlo, buildSchedule } from './calculations.js'
import InputPanel from './components/InputPanel.jsx'
import MetricsCards from './components/MetricsCards.jsx'
import MonteCarloChart from './components/MonteCarloChart.jsx'
import IncomeSourcesChart from './components/IncomeSourcesChart.jsx'
import ProjectionChart from './components/ProjectionChart.jsx'
import SensitivityTable from './components/SensitivityTable.jsx'
import SustainabilityTable from './components/SustainabilityTable.jsx'
import ReturnScenariosTable from './components/ReturnScenariosTable.jsx'
import DieWithZeroPanel from './components/DieWithZeroPanel.jsx'
import HouseholdPage from './components/HouseholdPage.jsx'

function NavTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-fire-orange/15 text-fire-orange'
          : 'text-gray-400 hover:text-gray-100'
      }`}
    >
      {children}
    </button>
  )
}

function SubTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-fire-orange/15 text-fire-orange'
          : 'text-gray-400 hover:text-gray-100 hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  )
}

const FIRE_VIEWS = [
  { key: 'oversikt', label: 'Översikt' },
  { key: 'risk', label: 'Risk (Monte Carlo)' },
  { key: 'dwz', label: 'Die With Zero' },
]

function FirePlanner({ inputs, update, reset, schedule, setOverride, resetSchedule, mc, sidebarOpen, stiftelseConfigured }) {
  const [view, setView] = useState('oversikt')
  return (
    <div className="flex flex-col lg:flex-row">
      <aside
        className={`${
          sidebarOpen ? 'block' : 'hidden'
        } lg:block lg:w-[360px] lg:flex-shrink-0 lg:h-[calc(100vh-3.25rem)] lg:sticky lg:top-[3.25rem] overflow-y-auto border-r border-border bg-surface`}
      >
        <InputPanel
          inputs={inputs}
          update={update}
          reset={reset}
          schedule={schedule}
          setOverride={setOverride}
          resetSchedule={resetSchedule}
          stiftelseConfigured={stiftelseConfigured}
        />
      </aside>

      <main className="flex-1 min-w-0 p-4 lg:p-6 space-y-6">
        {/* Nyckeltal — alltid synliga ovanför flikarna */}
        <MetricsCards inputs={inputs} schedule={schedule} mc={mc} />

        {/* Under-flikar — sticky under toppmenyn */}
        <div className="sticky top-[3.25rem] z-10 -mx-4 lg:-mx-6 flex flex-wrap gap-1 border-b border-border bg-bg/85 px-4 py-2 backdrop-blur lg:px-6">
          {FIRE_VIEWS.map((v) => (
            <SubTab key={v.key} active={view === v.key} onClick={() => setView(v.key)}>
              {v.label}
            </SubTab>
          ))}
        </div>

        {view === 'oversikt' && (
          <>
            <ProjectionChart inputs={inputs} schedule={schedule} />
            <IncomeSourcesChart inputs={inputs} schedule={schedule} />
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
              <SensitivityTable inputs={inputs} />
              <SustainabilityTable inputs={inputs} schedule={schedule} />
            </div>
            <ReturnScenariosTable inputs={inputs} schedule={schedule} />
          </>
        )}

        {view === 'risk' && <MonteCarloChart inputs={inputs} mc={mc} schedule={schedule} />}

        {view === 'dwz' && (
          <DieWithZeroPanel inputs={inputs} update={update} schedule={schedule} />
        )}

        <footer className="pt-2 pb-8 text-xs text-gray-500">
          Endast underlag för planering — inte finansiell rådgivning. SWR enligt
          Trinity-studien, schablonskatt på ISK avdragen i framskrivningen, förhöjt
          grundavdrag från 67.
        </footer>
      </main>
    </div>
  )
}

// Tillåter heltradskommentarer (// ...) i config-filerna så att varje fält kan
// dokumenteras direkt i JSON:en. Endast rader vars första icke-blanktecken är //
// tas bort — kommentarer måste alltså stå på egen rad (aldrig efter ett värde).
function parseJsonc(text) {
  const stripped = text
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
  return JSON.parse(stripped)
}

// Om iskAccounts är ifyllda härleds iskValue som summan av kontonas värden.
// Annars behålls det explicita iskValue. Gör kontona till sanningskälla.
function deriveIskValue(obj) {
  if (Array.isArray(obj.iskAccounts) && obj.iskAccounts.length > 0) {
    obj.iskValue = obj.iskAccounts.reduce((s, a) => s + (Number(a.value) || 0), 0)
  }
  return obj
}

function deriveCurrentAge(birthYear, birthMonth) {
  const today = new Date()
  const birth = new Date(birthYear, birthMonth - 1, 1)
  return Math.floor((today - birth) / (365.25 * 24 * 60 * 60 * 1000))
}

export default function App() {
  // --- Person 1 ---
  const [configDefaults, setConfigDefaults] = useState(defaults)
  const [inputs, setInputs] = useState(defaults)
  const [overrides, setOverrides] = useState({})

  // --- Partner ---
  const [partnerConfigDefaults, setPartnerConfigDefaults] = useState(partnerDefaults)
  const [partnerInputs, setPartnerInputs] = useState(partnerDefaults)
  const [partnerOverrides, setPartnerOverrides] = useState({})

  // --- Household ---
  const [hhDesiredSpend, setHhDesiredSpend] = useState(70000)
  const [hhPartner1GrossSalary, setHhPartner1GrossSalary] = useState(0)
  const [hhPartner2GrossSalary, setHhPartner2GrossSalary] = useState(0)
  const [hhSurvivorFraction, setHhSurvivorFraction] = useState(0.5)

  // --- UI ---
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [tab, setTab] = useState('fire')
  const [configError, setConfigError] = useState(null)

  useEffect(() => {
    fetch('/config.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then((txt) => {
        const cfg = parseJsonc(txt)
        // Person 1 (toppnivån i config)
        const merged = deriveIskValue({ ...defaults, ...cfg })
        if (merged.birthYear && merged.birthMonth) {
          merged.currentAge = deriveCurrentAge(merged.birthYear, merged.birthMonth)
        }
        if (cfg.grossSalary == null && cfg.hhPartner1GrossSalary != null) {
          merged.grossSalary = cfg.hhPartner1GrossSalary
        }
        setConfigDefaults(merged)
        setInputs(merged)

        // Household top-level fields
        if (cfg.hhDesiredSpend != null) setHhDesiredSpend(cfg.hhDesiredSpend)
        if (cfg.hhPartner1GrossSalary != null) setHhPartner1GrossSalary(cfg.hhPartner1GrossSalary)
        if (cfg.hhPartner2GrossSalary != null) setHhPartner2GrossSalary(cfg.hhPartner2GrossSalary)
        if (cfg.hhSurvivorFraction != null) setHhSurvivorFraction(cfg.hhSurvivorFraction)

        // Partner (nested under "partner" key)
        if (cfg.partner) {
          const pm = deriveIskValue({ ...partnerDefaults, ...cfg.partner })
          if (pm.birthYear && pm.birthMonth) {
            pm.currentAge = deriveCurrentAge(pm.birthYear, pm.birthMonth)
          }
          if (cfg.partner?.grossSalary == null && cfg.hhPartner2GrossSalary != null) {
            pm.grossSalary = cfg.hhPartner2GrossSalary
          }
          setPartnerConfigDefaults(pm)
          setPartnerInputs(pm)
        }
        setConfigError(null)
      })
      // Utan synligt fel skulle appen tyst visa exempel-defaults — flagga i stället.
      .catch((err) => setConfigError(String(err?.message ?? err)))
  }, [])

  // Person 1 updates
  const update = (patch) =>
    setInputs((prev) => {
      const next = { ...prev, ...patch }
      if ('birthYear' in patch || 'birthMonth' in patch) {
        next.currentAge = deriveCurrentAge(next.birthYear, next.birthMonth)
      }
      return next
    })
  const reset = () => setInputs(configDefaults)
  const setOverride = (age, patch) =>
    setOverrides((prev) => ({ ...prev, [age]: { ...prev[age], ...patch } }))
  const resetSchedule = () => setOverrides({})

  // Partner updates
  const updatePartner = (patch) =>
    setPartnerInputs((prev) => {
      const next = { ...prev, ...patch }
      if ('birthYear' in patch || 'birthMonth' in patch) {
        next.currentAge = deriveCurrentAge(next.birthYear, next.birthMonth)
      }
      return next
    })
  const resetPartner = () => setPartnerInputs(partnerConfigDefaults)
  const setPartnerOverride = (age, patch) =>
    setPartnerOverrides((prev) => ({ ...prev, [age]: { ...prev[age], ...patch } }))
  const resetPartnerSchedule = () => setPartnerOverrides({})

  const schedule = useMemo(() => buildSchedule(inputs, overrides), [inputs, overrides])
  const mc = useMemo(() => monteCarlo(inputs, schedule), [inputs, schedule])

  const partnerSchedule = useMemo(
    () => buildSchedule(partnerInputs, partnerOverrides),
    [partnerInputs, partnerOverrides]
  )
  const partnerMc = useMemo(
    () => monteCarlo(partnerInputs, partnerSchedule),
    [partnerInputs, partnerSchedule]
  )

  const showSidebarToggle = tab === 'fire' || tab === 'partner'

  return (
    <div className="min-h-screen bg-bg text-gray-200">
      <div className="sticky top-0 z-30 flex h-[3.25rem] items-center justify-between border-b border-border bg-surface px-4 py-2.5">
        <div className="flex items-center gap-4">
          <span className="font-semibold">🔥 FIRE</span>
          <nav className="flex items-center gap-1">
            <NavTab active={tab === 'fire'} onClick={() => setTab('fire')}>
              {inputs.name || 'Du'}
            </NavTab>
            <NavTab active={tab === 'partner'} onClick={() => setTab('partner')}>
              {partnerInputs.name || 'Partner'}
            </NavTab>
            <NavTab active={tab === 'household'} onClick={() => setTab('household')}>
              Hushåll
            </NavTab>
          </nav>
        </div>
        {showSidebarToggle && (
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="rounded-md border border-border px-3 py-1 text-sm lg:hidden"
          >
            {sidebarOpen ? 'Stäng' : 'Inställningar'}
          </button>
        )}
      </div>

      {configError && (
        <div className="border-b border-red-900/60 bg-red-950/40 px-4 py-2 text-xs text-red-300">
          ⚠ config.json kunde inte läsas ({configError}) — visar neutrala
          exempelvärden, inte dina riktiga siffror. Kontrollera att filen finns
          och är giltig JSONC.
        </div>
      )}

      {tab === 'fire' && (
        <FirePlanner
          inputs={inputs}
          update={update}
          reset={reset}
          schedule={schedule}
          setOverride={setOverride}
          resetSchedule={resetSchedule}
          mc={mc}
          sidebarOpen={sidebarOpen}
          stiftelseConfigured={configDefaults.stiftelseValue > 0}
        />
      )}

      {tab === 'partner' && (
        <FirePlanner
          inputs={partnerInputs}
          update={updatePartner}
          reset={resetPartner}
          schedule={partnerSchedule}
          setOverride={setPartnerOverride}
          resetSchedule={resetPartnerSchedule}
          mc={partnerMc}
          sidebarOpen={sidebarOpen}
          stiftelseConfigured={partnerConfigDefaults.stiftelseValue > 0}
        />
      )}

      {tab === 'household' && (
        <HouseholdPage
          p1inputs={inputs}
          p2inputs={partnerInputs}
          p1schedule={schedule}
          p2schedule={partnerSchedule}
          defaultHhSpend={hhDesiredSpend}
          defaultP1GrossSalary={hhPartner1GrossSalary}
          defaultP2GrossSalary={hhPartner2GrossSalary}
          survivorFraction={hhSurvivorFraction}
          baseCalYear={inputs.birthYear + inputs.currentAge}
        />
      )}
    </div>
  )
}
