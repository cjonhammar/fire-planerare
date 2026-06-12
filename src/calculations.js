// =============================================================================
// calculations.js — All FIRE math as pure, side-effect-free functions.
// No DOM, no React. Everything flows from `inputs` + a per-year `schedule`.
//
// The withdrawal phase is modeled YEAR BY YEAR. buildSchedule() produces one row
// per age from fireAge..lifeExpectancy. All config amounts are in TODAY's
// purchasing power and are indexed with inflation from currentAge (today) — the
// same anchor as the household view — so spend, pensions and salaries stay
// comparable in every calendar year. Every downstream calc (projection, FIRE
// number, sustainability, Monte Carlo, income chart, Die With Zero) reads from
// this schedule, so per-year edits flow everywhere.
// =============================================================================

export const partnerDefaults = {
  name: 'Partner',
  iskAccounts: [],
  iskValue: 0,
  ppValue: 0,
  grossSalary: 0,
  monthlySavings: 0,
  monthlySavingsFrom: 42,
  monthlySavingsTo: 60,
  birthYear: 1984,
  birthMonth: 1,
  currentAge: 42,
  fireAge: 60,
  fireAgeMonths: 0,
  lifeExpectancy: 90,
  returnRate: 0.06,
  inflation: 0.02,
  desiredSpend: 35000,
  targetEstate: 0,
  tjänstepension55_64: 0,
  tjänstepension65plus: 0,
  allmänPension65plus: 0,
  nordnetPrivat55_64: 0,
  kommunRate: 0.3255,
  // Stiftelse — engångskapital som betalas ut som annuitet (start/stop-ålder).
  stiftelseName: 'Stiftelse',
  stiftelseValue: 0,
  stiftelseRate: 0.04,
  stiftelseStartAge: 60,
  stiftelseEndAge: 65,
  // Extrajobb — månadslön (brutto, dagens kr) mellan start/stop, inflationsuppräknas.
  extraWorkName: 'Extrajobb',
  extraWorkMonthly: 0,
  extraWorkStartAge: 55,
  extraWorkEndAge: 65,
}

// Neutrala exempelvärden — alla riktiga siffror ska ligga i public/config.json
// (gitignore:ad). Visas bara om config-filen saknas/inte kan läsas, vilket
// App.jsx i så fall flaggar synligt.
export const defaults = {
  // Identity
  name: 'Du',
  // Portfolio — iskAccounts (valfritt) listar enskilda ISK-konton; om ifyllda
  // härleds iskValue som summan av deras värden (se App.jsx vid config-laddning).
  iskAccounts: [],
  iskValue: 5000000,
  ppValue: 0,
  grossSalary: 0,
  monthlySavings: 0,
  monthlySavingsFrom: 50,
  monthlySavingsTo: 55,
  // Birth date — currentAge is derived in App.jsx
  birthYear: 1976,
  birthMonth: 1,
  currentAge: 50,
  // FIRE age — fireAge (integer years) drives calculations; fireAgeMonths only for display
  fireAge: 55,
  fireAgeMonths: 0,
  lifeExpectancy: 90,

  // Return assumptions
  returnRate: 0.06, // nominal
  inflation: 0.02,

  // Base desired monthly spend (today's purchasing power, indexed from today)
  desiredSpend: 35000,

  // Target estate at death (for Die With Zero variant)
  targetEstate: 0,

  // Pension (gross monthly)
  tjänstepension55_64: 15000,
  tjänstepension65plus: 10000,
  allmänPension65plus: 18000,
  nordnetPrivat55_64: 0,

  // Swedish income tax — kommunalskatt + landsting + begravning for Tyresö 2025
  kommunRate: 0.3255,

  // Stiftelse — engångskapital som betalas ut som annuitet (namn: stiftelseName).
  stiftelseName: 'Stiftelse',
  stiftelseValue: 0,
  stiftelseRate: 0.04,
  stiftelseStartAge: 55,
  stiftelseEndAge: 60,
  // Extrajobb — månadslön (brutto) mellan start/stop, inflationsuppräknas.
  extraWorkName: 'Extrajobb',
  extraWorkMonthly: 0,
  extraWorkStartAge: 55,
  extraWorkEndAge: 65,
}

// -----------------------------------------------------------------------------
// ISK schablonskatt — effektiv andel av kapitalet per år. 2026: (SLR nov 2025
// 2,55 % + 1 %) × 30 % = 1,065 %. Dras av i ALLA kapital-framskrivningar så att
// den nominella avkastningen blir netto efter skatt. Förenkling: fribeloppet
// (300 000 kr/person från 2026) ignoreras — konservativt (~3 200 kr/år för
// mycket skatt per person).
// -----------------------------------------------------------------------------
export const ISK_TAX_RATE = 0.01065

// Trinity SWR-nivåer (CLAUDE.md): 4 % standard, 3,5 % konservativt.
export const SWR_STANDARD = 0.04
export const SWR_CONSERVATIVE = 0.035

// -----------------------------------------------------------------------------
// Phase definitions ("fasmodellen"). Built dynamically from fireAge..life-
// Expectancy with cuts at skattemässigt/pensionsmässigt viktiga åldrar
// (60, 65, 67) och därefter vart femte år. Used to group years in the
// sustainability table.
// -----------------------------------------------------------------------------
export function buildPhases(fireAge, lifeExpectancy) {
  const cuts = [60, 65, 67, 70, 75, 80, 85]
  const start = Math.min(fireAge, lifeExpectancy)
  const bounds = [start, ...cuts.filter((c) => c > start && c <= lifeExpectancy), lifeExpectancy + 1]
  const phases = []
  for (let i = 0; i < bounds.length - 1; i++) {
    const s = bounds[i]
    const e = bounds[i + 1] - 1
    if (e < s) continue
    phases.push({ label: `${s}–${e}`, startAge: s, endAge: e, years: e - s + 1 })
  }
  return phases
}

export function phaseLabelForAge(phases, age) {
  const p = phases.find((p) => age >= p.startAge && age <= p.endAge)
  if (p) return p.label
  return age < phases[0].startAge ? phases[0].label : phases[phases.length - 1].label
}

// -----------------------------------------------------------------------------
// Swedish income tax (pension/tjänst income), inkomstår 2025.
// Applies grundavdrag (ordinary, förhöjt för den som fyllt 66 vid årets ingång
// = fyller 67 under året), kommunalskatt, jobbskatteavdrag (endast arbets-
// inkomst) and statlig inkomstskatt. All values in SEK/year unless noted.
// Verifierad mot SKV:s tabeller och prop. 2025/26:32 (kodgranskning 2026-06-12).
// -----------------------------------------------------------------------------
const STATLIG_THRESHOLD = 625800 // skiktgräns 2025 (beskattningsbar förvärvsinkomst)
const STATLIG_RATE = 0.20
const PBB = 58_800 // prisbasbelopp 2025 — bas för grundavdrag och JAS

// Jobbskatteavdrag (JAS) — skattereduktion på ARBETSINKOMST, 2025 års regler
// (prop. 2025/26:32). Underlag i andelar av PRISBASBELOPPET, minus grundavdraget,
// × kommunalsatsen. Avtrappningen för höga inkomster är AVSKAFFAD från 2025 —
// över 8,08 PBB är underlaget konstant 2,776 PBB. Ges bara mot kommunalskatten.
// Förenkling: det förstärkta JAS för 66+ (22 % av arbetsinkomsten) modelleras ej.
function jobbskatteavdrag(arbetsinkomst, grundavdrag, kommunRate, kommunalTaxCap) {
  if (arbetsinkomst <= 0) return 0
  const ai = arbetsinkomst / PBB
  let underlag
  if (ai <= 0.91) underlag = arbetsinkomst
  else if (ai <= 3.24) underlag = (0.91 + 0.3874 * (ai - 0.91)) * PBB
  else if (ai <= 8.08) underlag = (1.813 + 0.199 * (ai - 3.24)) * PBB
  else underlag = 2.776 * PBB
  const jas = Math.max(0, (underlag - grundavdrag) * kommunRate)
  return Math.min(jas, kommunalTaxCap)
}

function grundavdragUnder65(annual) {
  // Ordinarie grundavdrag 2025 i andelar av prisbasbeloppet (63 kap. 3 § IL).
  // Max 0,77 PBB (≈45 300), golv 0,293 PBB (≈17 300). Avrundas uppåt till hundratal.
  if (annual <= 0) return 0
  const fi = annual / PBB
  let ga
  if (fi <= 0.99) ga = 0.423 * PBB
  else if (fi <= 2.72) ga = (0.423 + 0.2 * (fi - 0.99)) * PBB
  else if (fi <= 3.11) ga = 0.77 * PBB
  else if (fi <= 7.88) ga = (0.77 - 0.1 * (fi - 3.11)) * PBB
  else ga = 0.293 * PBB
  return Math.min(annual, Math.ceil(ga / 100) * 100)
}

// Förhöjt grundavdrag 2025 (fyllt 66 vid årets ingång) — styckvis linjär
// interpolation av SKV:s officiella tabell (bilaga 2). Ankarpunkter verifierade:
// skattefritt upp till 65 200; max 163 100 vid 474 900; platå till 643 300;
// golv 107 400 över 733 100.
const FORHOJT_GA_POINTS = [
  [0, 0],
  [65_200, 65_200],
  [300_000, 130_300],
  [360_000, 141_500],
  [474_900, 163_100],
  [643_300, 163_100],
  [733_100, 107_400],
]

function grundavdragFörhöjt(annual) {
  if (annual <= 0) return 0
  const pts = FORHOJT_GA_POINTS
  const last = pts[pts.length - 1]
  if (annual >= last[0]) return last[1]
  for (let i = 1; i < pts.length; i++) {
    if (annual <= pts[i][0]) {
      const [x0, y0] = pts[i - 1]
      const [x1, y1] = pts[i]
      return Math.min(annual, y0 + ((y1 - y0) * (annual - x0)) / (x1 - x0))
    }
  }
  return last[1]
}

// grossMonthly: total gross pension/tjänst income per month
// Returns { netto (monthly), taxMonthly, effectiveRate, statligSkatt (bool) }
export function swedenPensionTax(grossMonthly, age, kommunRate) {
  return swedenIncomeTax({ pensionAnnual: grossMonthly * 12, age, kommunRate })
}

// Salary tax — like pension tax but with jobbskatteavdrag (JAS).
// age påverkar förhöjt grundavdrag om personen arbetar efter 67.
export function swedenSalaryTax(grossMonthly, kommunRate, age = 60) {
  return swedenIncomeTax({ workAnnual: grossMonthly * 12, age, kommunRate })
}

// Inkomstskatt för EN person med både pensions- och arbetsinkomst. De läggs
// ihop för grundavdrag och statlig skiktgräns; jobbskatteavdraget beräknas
// ENBART på arbetsinkomsten (extrajobbet — stiftelsen är utskiftning och ger
// inte JAS). Belopp i kr/år in; returnerar månadsvärden.
// age styr förhöjt grundavdrag: >= 67 = fyller 67 under året = fyllt 66 vid
// årets ingång (2025 års regel).
export function swedenIncomeTax({ pensionAnnual = 0, workAnnual = 0, age = 60, kommunRate }) {
  const pension = Math.max(0, pensionAnnual)
  const work = Math.max(0, workAnnual)
  const total = pension + work
  if (total <= 0) return { netto: 0, taxMonthly: 0, effectiveRate: 0, statligSkatt: false }
  const gd = age >= 67 ? grundavdragFörhöjt(total) : grundavdragUnder65(total)
  const taxable = Math.max(0, total - gd)
  const kommunalTax = taxable * kommunRate
  const statligTax = taxable > STATLIG_THRESHOLD ? (taxable - STATLIG_THRESHOLD) * STATLIG_RATE : 0
  const jas = jobbskatteavdrag(work, gd, kommunRate, kommunalTax)
  const totalTax = Math.max(0, kommunalTax + statligTax - jas)
  return {
    netto: (total - totalTax) / 12,
    taxMonthly: totalTax / 12,
    effectiveRate: totalTax / total,
    statligSkatt: statligTax > 0,
  }
}

// -----------------------------------------------------------------------------
// Model spend per age — desiredSpend är i DAGENS köpkraft och indexeras med
// inflationen från currentAge (idag), inte från fireAge. Samma ankare som
// pensionerna och hushållsvyn, så alla belopp är jämförbara per kalenderår.
// -----------------------------------------------------------------------------
export function modelSpendForAge(inputs, age) {
  return inputs.desiredSpend * Math.pow(1 + inputs.inflation, age - inputs.currentAge)
}

// -----------------------------------------------------------------------------
// Stiftelse — annual gross withdrawal (ordinary annuity depleting fund over the
// payout window). Fund grows at stiftelseRate until start. Namnet sätts via
// stiftelseName i config. Schemat börjar vid FIRE, så fönstret kläms till att
// börja tidigast vid max(fireAge, currentAge) — annars skulle utbetalningar
// före FIRE tyst försvinna ur modellen.
// -----------------------------------------------------------------------------
export function stiftelseWindow(inputs) {
  const start = Math.max(inputs.stiftelseStartAge, inputs.fireAge, inputs.currentAge)
  return { start, end: Math.max(inputs.stiftelseEndAge, start) }
}

export function stiftelseAnnualGross(inputs) {
  const { stiftelseValue, stiftelseRate: r, currentAge } = inputs
  if (!stiftelseValue) return 0
  const { start, end } = stiftelseWindow(inputs)
  const valueAtStart = stiftelseValue * Math.pow(1 + r, start - currentAge)
  const n = end - start + 1
  return r === 0 ? valueAtStart / n : (valueAtStart * r) / (1 - Math.pow(1 + r, -n))
}

// -----------------------------------------------------------------------------
// Per-year withdrawal schedule — the single source of truth.
// overrides: { [age]: { spend?: number, extra?: number } }
// Returns rows with: age, phase, spend, pensionTjanste, pensionAllman,
//   stiftelse, extraWork, pensionNetto (= alla icke-ISK netto: pension +
//   stiftelse + extrajobb), taxMonthly, effectiveRate, statligSkatt, extra,
//   iskMonthlyNeed, iskAnnual, totalIncomeMonthly, overridden
// -----------------------------------------------------------------------------
export function buildSchedule(inputs, overrides = {}) {
  const rows = []
  const stiftelseGrossAnnual = stiftelseAnnualGross(inputs)
  const stiftelseWin = stiftelseWindow(inputs)
  // Guard: om fireAge ligger i det förflutna (redan FIREd) startar simuleringen
  // idag i stället för att producera nonsens-rader för historiska år.
  const startAge = Math.max(inputs.fireAge, inputs.currentAge)
  const phases = buildPhases(startAge, inputs.lifeExpectancy)

  for (let age = startAge; age <= inputs.lifeExpectancy; age++) {
    const ov = overrides[age] || {}
    const spend = ov.spend != null ? ov.spend : modelSpendForAge(inputs, age)
    const extra = ov.extra != null ? ov.extra : 0

    // Gross pension components (monthly). Alla pensioner indexeras med inflationen
    // från IDAG (currentAge) — minPension-beloppen är reala (prognos med
    // "avkastning utöver inflation") i dagens köpkraft, samma ankare som utgiften
    // och hushållsvyn. Gäller tjänste, privat och allmän.
    const pensionInflFactor = Math.pow(1 + inputs.inflation, age - inputs.currentAge)
    let tjBrutto, alBrutto
    if (age < 65) {
      tjBrutto = (inputs.tjänstepension55_64 + inputs.nordnetPrivat55_64) * pensionInflFactor
      alBrutto = 0
    } else {
      tjBrutto = inputs.tjänstepension65plus * pensionInflFactor
      alBrutto = inputs.allmänPension65plus * pensionInflFactor
    }
    // Stiftelse (engångskapital som betalas ut som annuitet). Tas upp som inkomst
    // av tjänst men ger INTE jobbskatteavdrag (utskiftning till andelsägare, ej
    // ersättning för arbete) — beskattas alltså som pension. De 30 % som dras vid
    // utbetalning är endast preliminärskatt; slutlig skatt är den vanliga här.
    const stiftelseGross =
      age >= stiftelseWin.start && age <= stiftelseWin.end
        ? stiftelseGrossAnnual / 12
        : 0
    // Extrajobb — månadslön (brutto) mellan extraWorkStartAge..EndAge, indexeras
    // med inflationen. Detta är riktig arbetsinkomst och ger jobbskatteavdrag.
    const extraWorkGross =
      inputs.extraWorkMonthly > 0 &&
      age >= inputs.extraWorkStartAge &&
      age <= inputs.extraWorkEndAge
        ? inputs.extraWorkMonthly * pensionInflFactor
        : 0

    // Sambeskattning: allt läggs ihop för grundavdrag/statlig gräns. Jobbskatte-
    // avdrag ges bara på arbetsinkomsten (= extrajobbet). Stiftelse + pension
    // ligger i pensionsdelen (ingen JAS).
    const pensionGrossMonthly = tjBrutto + alBrutto + stiftelseGross
    const workGrossMonthly = extraWorkGross
    const totalGrossMonthly = pensionGrossMonthly + workGrossMonthly
    const taxResult = swedenIncomeTax({
      pensionAnnual: pensionGrossMonthly * 12,
      workAnnual: workGrossMonthly * 12,
      age,
      kommunRate: inputs.kommunRate,
    })
    // Nettokvot tillämpas på varje källa för stapeluppdelningen (approximation;
    // totalen är exakt). pensionNetto = allt icke-ISK netto (täcker utgiften).
    const nettoRatio = totalGrossMonthly > 0 ? taxResult.netto / totalGrossMonthly : 1
    const pensionTjanste = tjBrutto * nettoRatio
    const pensionAllman = alBrutto * nettoRatio
    const stiftelse = stiftelseGross * nettoRatio
    const extraWork = extraWorkGross * nettoRatio
    const pensionNetto = taxResult.netto

    const taxMonthly = taxResult.taxMonthly
    const effectiveRate = taxResult.effectiveRate

    const iskMonthlyNeed = Math.max(0, spend - pensionNetto)
    const iskAnnual = iskMonthlyNeed * 12 + extra

    rows.push({
      age,
      phase: phaseLabelForAge(phases, age),
      spend,
      pensionTjanste,
      pensionAllman,
      stiftelse,
      extraWork,
      pensionNetto,
      taxMonthly,
      effectiveRate,
      statligSkatt: taxResult.statligSkatt,
      extra,
      iskMonthlyNeed,
      iskAnnual,
      totalIncomeMonthly: pensionNetto + iskMonthlyNeed + extra / 12,
      overridden: ov.spend != null || ov.extra != null,
    })
  }
  return rows
}

export function defaultSchedule(inputs) {
  return buildSchedule(inputs, {})
}

// -----------------------------------------------------------------------------
// Capital at fireAge — grows current portfolio with savings, using rate r
// -----------------------------------------------------------------------------
export function computeCapitalAtFire(inputs, r = inputs.returnRate) {
  const rNet = r - ISK_TAX_RATE
  let cap = inputs.iskValue + inputs.ppValue
  for (let age = inputs.currentAge; age < inputs.fireAge; age++) {
    const saving =
      age >= inputs.monthlySavingsFrom && age < inputs.monthlySavingsTo
        ? inputs.monthlySavings
        : 0
    cap = cap * (1 + rNet) + saving * 12
  }
  return cap
}

// -----------------------------------------------------------------------------
// Annuity / FV helpers
// -----------------------------------------------------------------------------
export function annuity(r, n) {
  return r === 0 ? n : (1 - Math.pow(1 + r, -n)) / r
}

export function FV(r, n, pmt, pv) {
  const g = Math.pow(1 + r, n)
  if (r === 0) return pv - pmt * n
  return pv * g - (pmt * (g - 1)) / r
}

// -----------------------------------------------------------------------------
// FIRE number
// -----------------------------------------------------------------------------
export function fireNumber(inputs, schedule = buildSchedule(inputs)) {
  const rNet = inputs.returnRate - ISK_TAX_RATE
  let pv = 0
  schedule.forEach((row, k) => {
    pv += row.iskAnnual / Math.pow(1 + rNet, k + 1)
  })
  return pv
}

// -----------------------------------------------------------------------------
// Deterministic year-by-year projection
// -----------------------------------------------------------------------------
export function projection(inputs, schedule = buildSchedule(inputs)) {
  const rNet = inputs.returnRate - ISK_TAX_RATE
  let capital = inputs.iskValue + inputs.ppValue
  const rows = []

  for (let age = inputs.currentAge; age < inputs.fireAge; age++) {
    const saving =
      age >= inputs.monthlySavingsFrom && age < inputs.monthlySavingsTo
        ? inputs.monthlySavings
        : 0
    capital = capital * (1 + rNet) + saving * 12
    rows.push({
      age,
      capital,
      iskWithdrawal: 0,
      pensionNetto: 0,
      totalIncome: 0,
      phase: 'Ackumulering',
    })
  }

  for (const row of schedule) {
    capital = Math.max(0, capital * (1 + rNet) - row.iskAnnual)
    rows.push({
      age: row.age,
      capital,
      iskWithdrawal: row.iskAnnual,
      pensionNetto: row.pensionNetto * 12,
      totalIncome: row.iskAnnual + row.pensionNetto * 12,
      phase: row.phase,
    })
  }
  return rows
}

// -----------------------------------------------------------------------------
// Sustainability
// -----------------------------------------------------------------------------
export function sustainability(inputs, r, schedule = buildSchedule(inputs)) {
  const rNet = r - ISK_TAX_RATE
  let cap = computeCapitalAtFire(inputs, r)
  const capitalAtFire = cap

  // Samma fasindelning som buildSchedule använder för row.phase
  const phases = buildPhases(Math.max(inputs.fireAge, inputs.currentAge), inputs.lifeExpectancy)
  const phaseAgg = {}
  for (const ph of phases) phaseAgg[ph.label] = { sum: 0, count: 0 }

  let totalWithdrawn = 0
  let depletedAge = null

  for (const row of schedule) {
    // Faktiskt uttag kapas till tillgängligt kapital — du kan inte ta ut mer än
    // vad portföljen rymmer. I underskottsscenarier blir uttaget därför lägre än
    // behovet (row.iskAnnual) och kapitalet bottnar på 0.
    const grown = Math.max(0, cap * (1 + rNet))
    const actualIsk = Math.min(row.iskAnnual, grown)
    cap = grown - actualIsk
    if (depletedAge === null && actualIsk < row.iskAnnual - 0.5) depletedAge = row.age

    const agg = phaseAgg[row.phase]
    if (agg) {
      agg.sum += actualIsk
      agg.count += 1
    }
    totalWithdrawn += actualIsk
  }

  const perPhaseAvg = phases.map((ph) => {
    const a = phaseAgg[ph.label]
    return { label: ph.label, avgIsk: a.count ? a.sum / a.count : 0, sum: a.sum }
  })

  return {
    returnRate: r,
    capitalAtFire,
    portfolioAt90: cap,
    perPhaseAvg,
    totalWithdrawn,
    depleted: depletedAge !== null,
    depletedAge,
  }
}

export function depletion(inputs, schedule = buildSchedule(inputs), r = inputs.returnRate) {
  const rNet = r - ISK_TAX_RATE
  let cap = computeCapitalAtFire(inputs, r)
  for (const row of schedule) {
    cap = cap * (1 + rNet) - row.iskAnnual
    if (cap < 0) return { depleted: true, age: row.age, shortfall: cap }
  }
  return { depleted: false, age: null, shortfall: cap }
}

export const SCENARIOS = [
  { key: 'bear', label: 'Bear', r: 0.03 },
  { key: 'low', label: 'Låg', r: 0.05 },
  { key: 'base', label: 'Bas', r: 0.06 },
  { key: 'optimistic', label: 'Optimistisk', r: 0.08 },
  { key: 'best', label: 'Bäst', r: 0.1 },
]

export function sustainabilityScenarios(inputs, schedule = buildSchedule(inputs)) {
  return SCENARIOS.map((s) => ({ ...s, ...sustainability(inputs, s.r, schedule) }))
}

// -----------------------------------------------------------------------------
// Normal-distribution sampler (Box–Muller)
// -----------------------------------------------------------------------------
function randNormal(mean, std) {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  return mean + std * z
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0
  const idx = (p / 100) * (sortedArr.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sortedArr[lo]
  return sortedArr[lo] + (sortedArr[hi] - sortedArr[lo]) * (idx - lo)
}

// -----------------------------------------------------------------------------
// Monte Carlo simulation
// -----------------------------------------------------------------------------
export function monteCarlo(inputs, schedule = buildSchedule(inputs), opts = {}) {
  const sims = opts.sims ?? 10000
  const mean = opts.mean ?? inputs.returnRate
  const std = opts.std ?? 0.15
  // Slumpmässig inflation (PV: inflationModel=2). När inflStd > 0 dras en
  // årlig inflation per simulering; uttaget skalas med kvoten mellan den
  // slumpade och den deterministiska kumulativa inflationen. Approximation:
  // hela uttaget skalas (utgiftsdelen följer inflationen exakt, pensions-
  // avdraget något grovt) men fångar inflationsosäkerheten i konen.
  const inflMean = opts.inflMean ?? inputs.inflation
  const inflStd = opts.inflStd ?? 0
  // Guard mot fireAge i det förflutna (schemat börjar då vid currentAge i stället)
  const accumYears = Math.max(0, inputs.fireAge - inputs.currentAge)
  const startCapital = inputs.iskValue + inputs.ppValue
  const isk = schedule.map((r) => r.iskAnnual)
  const postFireAges = schedule.map((r) => r.age)

  // All ages for spaghetti: currentAge → lifeExpectancy
  const allAges = []
  for (let a = inputs.currentAge; a <= inputs.lifeExpectancy; a++) allAges.push(a)
  const N_SAMPLE = Math.min(100, sims)
  const samplePaths = Array.from({ length: N_SAMPLE }, () => new Float64Array(allAges.length))

  const capitalsPerAge = postFireAges.map(() => new Float64Array(sims))
  const solventPerAge = new Int32Array(postFireAges.length)
  let survived = 0

  for (let s = 0; s < sims; s++) {
    let cap = startCapital
    for (let y = 0; y < accumYears; y++) {
      const age = inputs.currentAge + y
      const saving = age >= inputs.monthlySavingsFrom && age < inputs.monthlySavingsTo
        ? inputs.monthlySavings : 0
      cap = cap * (1 + randNormal(mean, std) - ISK_TAX_RATE) + saving * 12
      if (s < N_SAMPLE) samplePaths[s][y] = cap
    }
    let randCum = 1
    let detCum = 1
    for (let a = 0; a < postFireAges.length; a++) {
      const w = inflStd > 0 ? isk[a] * (randCum / detCum) : isk[a]
      cap = Math.max(0, cap * (1 + randNormal(mean, std) - ISK_TAX_RATE) - w)
      capitalsPerAge[a][s] = cap
      if (cap > 0) solventPerAge[a]++
      if (s < N_SAMPLE) samplePaths[s][accumYears + a] = cap
      if (inflStd > 0) {
        randCum *= 1 + randNormal(inflMean, inflStd)
        detCum *= 1 + inflMean
      }
    }
    if (cap > 0) survived++
  }

  const fan = postFireAges.map((age, a) => {
    const arr = Array.from(capitalsPerAge[a]).sort((x, y) => x - y)
    return {
      age,
      p10: percentile(arr, 10),
      p25: percentile(arr, 25),
      p50: percentile(arr, 50),
      p75: percentile(arr, 75),
      p90: percentile(arr, 90),
      solvent: (solventPerAge[a] / sims) * 100,
    }
  })

  const successByAge = postFireAges.map((age, a) => ({
    age,
    solvent: (solventPerAge[a] / sims) * 100,
  }))

  const last = fan[fan.length - 1] || { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 }
  const maxCap = Math.max(...fan.map(f => f.p90)) * 1.1 || 1
  const samplePathsArr = Array.from(samplePaths, p => Array.from(p))

  return {
    successRate: (survived / sims) * 100,
    medianAt90: last.p50,
    p10At90: last.p10,
    p25At90: last.p25,
    p75At90: last.p75,
    p90At90: last.p90,
    fan,
    successByAge,
    sims,
    samplePaths: samplePathsArr,
    allAges,
    maxCap,
  }
}

// -----------------------------------------------------------------------------
// Fixed-return scenarios (PV: returnList) — slutkapital per antagen avkastning
// -----------------------------------------------------------------------------
export const FIXED_RETURN_RATES = [0, 0.025, 0.05, 0.075, 0.1, 0.125]

export function fixedReturnScenarios(inputs, schedule = buildSchedule(inputs), rates = FIXED_RETURN_RATES) {
  return rates.map((r) => {
    const sus = sustainability(inputs, r, schedule)
    return {
      rate: r,
      capitalAtFire: sus.capitalAtFire,
      portfolioAt90: sus.portfolioAt90,
      totalWithdrawn: sus.totalWithdrawn,
      depleted: sus.depleted,
      depletedAge: sus.depletedAge,
    }
  })
}

// -----------------------------------------------------------------------------
// Die With Zero
// -----------------------------------------------------------------------------
function portfolioAt90Scaled(inputs, schedule, scale) {
  const rNet = inputs.returnRate - ISK_TAX_RATE
  let cap = computeCapitalAtFire(inputs, inputs.returnRate)
  let totalWithdrawn = 0
  for (const row of schedule) {
    const need = Math.max(0, row.spend * scale - row.pensionNetto) * 12
    const isk = need + row.extra
    cap = cap * (1 + rNet) - isk
    totalWithdrawn += isk
  }
  return { cap, totalWithdrawn }
}

export function dieWithZero(inputs, schedule = buildSchedule(inputs)) {
  const target = inputs.targetEstate ?? 0
  let lo = 0
  let hi = 20
  let scale = 1
  for (let i = 0; i < 200; i++) {
    scale = (lo + hi) / 2
    const { cap } = portfolioAt90Scaled(inputs, schedule, scale)
    if (Math.abs(cap - target) <= 10000) break
    if (cap > target) lo = scale
    else hi = scale
  }

  const dwz = portfolioAt90Scaled(inputs, schedule, scale)
  const std = portfolioAt90Scaled(inputs, schedule, 1)
  const baseFirst = schedule[0]?.spend ?? inputs.desiredSpend
  const dwzFirst = baseFirst * scale

  return {
    scale,
    dwzMonthlySpend: dwzFirst,
    extraPerMonth: dwzFirst - baseFirst,
    extraLifetime: dwz.totalWithdrawn - std.totalWithdrawn,
    standard: { portfolioAt90: std.cap, totalWithdrawn: std.totalWithdrawn },
    dwz: { portfolioAt90: dwz.cap, totalWithdrawn: dwz.totalWithdrawn },
  }
}

export function dwzTrajectories(inputs, schedule = buildSchedule(inputs)) {
  const { scale } = dieWithZero(inputs, schedule)
  const rNet = inputs.returnRate - ISK_TAX_RATE
  const capFire = computeCapitalAtFire(inputs, inputs.returnRate)
  let capS = capFire
  let capD = capFire
  const out = []
  for (const row of schedule) {
    const iskS = row.iskAnnual
    const needD = Math.max(0, row.spend * scale - row.pensionNetto) * 12 + row.extra
    capS = Math.max(0, capS * (1 + rNet) - iskS)
    capD = Math.max(0, capD * (1 + rNet) - needD)
    out.push({ age: row.age, standard: capS, dwz: capD })
  }
  return out
}

// -----------------------------------------------------------------------------
// Sensitivity grid
// -----------------------------------------------------------------------------
export function sensitivityGrid(inputs, opts = {}) {
  const spends = opts.spends ?? rangeStep(30000, 100000, 5000)
  const rates = opts.rates ?? [0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09]
  const rows = spends.map((spend) => {
    const cells = rates.map((r) => {
      const scenario = { ...inputs, desiredSpend: spend, returnRate: r }
      const fn = fireNumber(scenario, buildSchedule(scenario, {}))
      return { rate: r, fireNumber: fn }
    })
    return { spend, cells }
  })
  return { spends, rates, rows }
}

function rangeStep(start, end, step) {
  const out = []
  for (let v = start; v <= end + 1e-9; v += step) out.push(Math.round(v))
  return out
}

// -----------------------------------------------------------------------------
// Summary statistics
// -----------------------------------------------------------------------------
export function summary(inputs, schedule = buildSchedule(inputs)) {
  const totalIskWithdrawn = schedule.reduce((s, r) => s + r.iskAnnual, 0)
  const totalPensionReceived = schedule.reduce((s, r) => s + r.pensionNetto * 12, 0)
  const freeCapital = inputs.iskValue + inputs.ppValue
  const fn = fireNumber(inputs, schedule)
  const capitalAtFire = computeCapitalAtFire(inputs)

  // Trinity-referens (CLAUDE.md): målbelopp = 25 × årsutgift (4 % SWR),
  // samt konservativt 3,5 % (≈ 28,6 ×). Baseras på utgiften vid FIRE.
  const annualSpendAtFire = (schedule[0]?.spend ?? inputs.desiredSpend) * 12
  const trinity25x = annualSpendAtFire / SWR_STANDARD
  const trinity35 = annualSpendAtFire / SWR_CONSERVATIVE

  return {
    freeCapital,
    fireNumber: fn,
    coverageRatio: fn > 0 ? capitalAtFire / fn : 0,
    capitalAtFire,
    totalIskWithdrawn,
    totalPensionReceived,
    totalIncome: totalIskWithdrawn + totalPensionReceived,
    iskTaxPerYear: freeCapital * ISK_TAX_RATE,
    annualSpendAtFire,
    trinity25x,
    trinity35,
  }
}

// -----------------------------------------------------------------------------
// Income sources per year (monthly figures) — for IncomeSourcesChart
// -----------------------------------------------------------------------------
export function incomeSources(inputs, schedule = buildSchedule(inputs)) {
  const rows = []
  let cap = inputs.iskValue + inputs.ppValue

  // Pre-FIRE accumulation years
  for (let age = inputs.currentAge; age < inputs.fireAge; age++) {
    const inflFactor = Math.pow(1 + inputs.inflation, age - inputs.currentAge)
    const salaryTax = inputs.grossSalary > 0
      ? swedenSalaryTax(inputs.grossSalary * inflFactor, inputs.kommunRate)
      : { netto: 0, taxMonthly: 0 }
    const saving = age >= inputs.monthlySavingsFrom && age < inputs.monthlySavingsTo
      ? inputs.monthlySavings : 0
    cap = cap * (1 + inputs.returnRate - ISK_TAX_RATE) + saving * 12
    rows.push({
      age, label: String(age),
      tjanste: 0, allman: 0, stiftelse: 0, extraWork: 0, isk: 0, extra: 0,
      skatt: Math.round(salaryTax.taxMonthly),
      desired: 0,
      lon: Math.round(salaryTax.netto),
      effectiveRate: salaryTax.effectiveRate ?? 0,
    })
  }

  // Post-FIRE retirement years
  for (const row of schedule) {
    const hasCapital = cap > 0
    cap = Math.max(0, cap * (1 + inputs.returnRate - ISK_TAX_RATE) - row.iskAnnual)
    rows.push({
      age: row.age, label: String(row.age),
      tjanste: Math.round(row.pensionTjanste),
      allman: Math.round(row.pensionAllman),
      stiftelse: Math.round(row.stiftelse),
      extraWork: Math.round(row.extraWork),
      isk: hasCapital ? Math.round(row.iskMonthlyNeed) : 0,
      extra: hasCapital ? Math.round(row.extra / 12) : 0,
      skatt: Math.round(row.taxMonthly),
      desired: Math.round(row.spend),
      lon: 0,
      effectiveRate: row.effectiveRate,
    })
  }

  return rows
}

// -----------------------------------------------------------------------------
// Household simulation — combines two persons' portfolios from baseCalYear
// (today) until p2's lifeExpectancy. p1schedule / p2schedule are pre-built with
// buildSchedule() — their pensions are indexed from currentAge (today), the
// same anchor as the household spend, so the amounts are comparable per
// calendar year.
//
// p1GrossSalary / p2GrossSalary: gross monthly salary in today's money.
//   Netto is computed via swedenSalaryTax each year on the inflation-adjusted gross.
// baseCalYear: start year (typically current year = p1.birthYear + p1.currentAge).
// survivorFraction: share of p1's portfolio p2 keeps when p1 dies (rest = child inheritance).
//
// Modellval (medvetna förenklingar):
//  - p1:s returnRate/inflation används för BÅDA portföljerna.
//  - Löneöverskott utöver monthlySavings sparas inte (konsumeras) — konservativt.
//  - Underskott (utgift > nettoinkomster) täcks alltid från ISK, även under
//    ackumuleringsåren.
//  - Endast p1:s död modelleras (p1 antas äldst); simuleringen slutar vid p2:s
//    livslängd.
// -----------------------------------------------------------------------------
export function householdProjection(p1, p2, hhMonthlySpend, p2GrossSalary, p1GrossSalary, p1schedule, p2schedule, baseCalYear, survivorFraction = 0.5) {
  const startCalYear = baseCalYear ?? (p1.birthYear + p1.currentAge)
  const endCalYear = p2.birthYear + p2.lifeExpectancy
  const r = p1.returnRate - ISK_TAX_RATE
  const inf = p1.inflation
  const p1DeathCalYear = p1.birthYear + p1.lifeExpectancy

  const p1ByAge = {}
  for (const row of p1schedule) p1ByAge[row.age] = row
  const p2ByAge = {}
  for (const row of p2schedule) p2ByAge[row.age] = row

  // Separate portfolios tracked independently
  let capP1 = p1.iskValue + p1.ppValue
  let capP2 = p2.iskValue + p2.ppValue
  let inheritedByChild = 0

  const rows = []
  for (let calYear = startCalYear; calYear <= endCalYear; calYear++) {
    const p1Age = calYear - p1.birthYear
    const p2Age = calYear - p2.birthYear
    const p1Alive = p1Age <= p1.lifeExpectancy
    const p2Alive = p2Age <= p2.lifeExpectancy
    const p1Working = p1Alive && p1Age < p1.fireAge
    const p2Working = p2Alive && p2Age < p2.fireAge

    // Inheritance split: first year after p1's death
    if (calYear === p1DeathCalYear + 1 && capP1 > 0) {
      inheritedByChild = capP1 * (1 - survivorFraction)
      capP2 += capP1 * survivorFraction
      capP1 = 0
    }

    const yearsSinceStart = calYear - startCalYear
    const inflFactor = Math.pow(1 + inf, yearsSinceStart)

    // Salary tax (gross → netto)
    const p1SalaryTax = p1Working && p1GrossSalary > 0
      ? swedenSalaryTax(p1GrossSalary * inflFactor, p1.kommunRate, p1Age)
      : { netto: 0, taxMonthly: 0 }
    const p2SalaryTax = p2Working && p2GrossSalary > 0
      ? swedenSalaryTax(p2GrossSalary * inflFactor, p2.kommunRate, p2Age)
      : { netto: 0, taxMonthly: 0 }

    // Pension netto from pre-built schedules
    const p1Row = p1Alive && !p1Working ? p1ByAge[p1Age] : null
    const p2Row = p2Alive && !p2Working ? p2ByAge[p2Age] : null
    const p1Pension = p1Row ? p1Row.pensionNetto : 0
    const p2Pension = p2Row ? p2Row.pensionNetto : 0

    const spend = hhMonthlySpend * inflFactor
    const passiveAndWork = p1Pension + p1SalaryTax.netto + p2Pension + p2SalaryTax.netto
    // Underskott täcks alltid från ISK — även medan någon fortfarande arbetar
    // (tidigare ignorerades underskott helt så länge p1 arbetade).
    const iskMonthlyTotal = Math.max(0, spend - passiveAndWork)

    // Split ISK withdrawal proportionally between portfolios (symmetriskt)
    const totalCap = capP1 + capP2
    const p1IskMonthly = totalCap > 0 ? iskMonthlyTotal * (capP1 / totalCap) : 0
    const p2IskMonthly = iskMonthlyTotal - p1IskMonthly

    // Savings during accumulation
    const p1Saving = p1Working && p1Age >= p1.monthlySavingsFrom && p1Age < p1.monthlySavingsTo
      ? p1.monthlySavings : 0
    const p2Saving = p2Working && p2Age >= p2.monthlySavingsFrom && p2Age < p2.monthlySavingsTo
      ? p2.monthlySavings : 0

    capP1 = Math.max(0, capP1 * (1 + r) + p1Saving * 12 - p1IskMonthly * 12)
    capP2 = Math.max(0, capP2 * (1 + r) + p2Saving * 12 - p2IskMonthly * 12)

    const totalTax = p1SalaryTax.taxMonthly + p2SalaryTax.taxMonthly
      + (p1Row ? p1Row.taxMonthly : 0)
      + (p2Row ? p2Row.taxMonthly : 0)

    rows.push({
      calYear, p1Age, p2Age,
      capitalP1: capP1, capitalP2: capP2, capital: capP1 + capP2,
      p1WorkIncome: p1SalaryTax.netto,
      p2WorkIncome: p2SalaryTax.netto,
      p1Pension, p2Pension,
      p1IskMonthly: capP1 > 0 ? p1IskMonthly : 0,
      p2IskMonthly: capP2 > 0 ? p2IskMonthly : 0,
      iskMonthly: iskMonthlyTotal,
      skatt: totalTax,
      spend,
      p1Alive, p2Alive, p1Working, p2Working,
      inheritedByChild: calYear === p1DeathCalYear + 1 ? inheritedByChild : 0,
    })
  }
  return rows
}

// -----------------------------------------------------------------------------
// Household Monte Carlo — stochastic returns on combined ISK portfolios.
// Non-stochastic elements (pensions, salaries, savings) are deterministic.
// -----------------------------------------------------------------------------
export function householdMonteCarlo(p1, p2, hhMonthlySpend, p2GrossSalary, p1GrossSalary, p1schedule, p2schedule, baseCalYear, survivorFraction = 0.5, opts = {}) {
  const sims = opts.sims ?? 5000
  const mean = opts.mean ?? p1.returnRate
  const std = opts.std ?? 0.15

  const startCalYear = baseCalYear ?? (p1.birthYear + p1.currentAge)
  const endCalYear = p2.birthYear + p2.lifeExpectancy
  const p1DeathCalYear = p1.birthYear + p1.lifeExpectancy
  const inf = p1.inflation

  const p1ByAge = {}
  for (const row of p1schedule) p1ByAge[row.age] = row
  const p2ByAge = {}
  for (const row of p2schedule) p2ByAge[row.age] = row

  // Pre-compute deterministic per-year data (incomes, savings, spend)
  const calYears = []
  for (let y = startCalYear; y <= endCalYear; y++) calYears.push(y)

  const yearData = calYears.map((calYear) => {
    const p1Age = calYear - p1.birthYear
    const p2Age = calYear - p2.birthYear
    const p1Alive = p1Age <= p1.lifeExpectancy
    const p2Alive = p2Age <= p2.lifeExpectancy
    const p1Working = p1Alive && p1Age < p1.fireAge
    const p2Working = p2Alive && p2Age < p2.fireAge
    const inflFactor = Math.pow(1 + inf, calYear - startCalYear)

    const p1SalNetto = p1Working && p1GrossSalary > 0
      ? swedenSalaryTax(p1GrossSalary * inflFactor, p1.kommunRate, p1Age).netto : 0
    const p2SalNetto = p2Working && p2GrossSalary > 0
      ? swedenSalaryTax(p2GrossSalary * inflFactor, p2.kommunRate, p2Age).netto : 0

    const p1Row = p1Alive && !p1Working ? p1ByAge[p1Age] : null
    const p2Row = p2Alive && !p2Working ? p2ByAge[p2Age] : null
    const p1Pension = p1Row ? p1Row.pensionNetto : 0
    const p2Pension = p2Row ? p2Row.pensionNetto : 0

    const spend = hhMonthlySpend * inflFactor
    const fixedIncome = p1Pension + p1SalNetto + p2Pension + p2SalNetto
    const iskMonthlyNeeded = Math.max(0, spend - fixedIncome)

    const p1Saving = p1Working && p1Age >= p1.monthlySavingsFrom && p1Age < p1.monthlySavingsTo
      ? p1.monthlySavings * 12 : 0
    const p2Saving = p2Working && p2Age >= p2.monthlySavingsFrom && p2Age < p2.monthlySavingsTo
      ? p2.monthlySavings * 12 : 0

    return { iskAnnual: iskMonthlyNeeded * 12, p1Saving, p2Saving, isInheritanceYear: calYear === p1DeathCalYear + 1 }
  })

  const capitalsPerYear = calYears.map(() => new Float64Array(sims))
  let survived = 0

  for (let s = 0; s < sims; s++) {
    let capP1 = p1.iskValue + p1.ppValue
    let capP2 = p2.iskValue + p2.ppValue

    for (let yi = 0; yi < yearData.length; yi++) {
      const yd = yearData[yi]
      if (yd.isInheritanceYear && capP1 > 0) {
        capP2 += capP1 * survivorFraction
        capP1 = 0
      }
      const r = randNormal(mean, std) - ISK_TAX_RATE
      const total = capP1 + capP2
      const p1Frac = total > 0 ? capP1 / total : 0
      const p1Isk = yd.iskAnnual * p1Frac
      const p2Isk = yd.iskAnnual - p1Isk
      capP1 = Math.max(0, capP1 * (1 + r) + yd.p1Saving - p1Isk)
      capP2 = Math.max(0, capP2 * (1 + r) + yd.p2Saving - p2Isk)
      capitalsPerYear[yi][s] = capP1 + capP2
    }
    if (capP1 + capP2 > 0) survived++
  }

  const fan = calYears.map((calYear, yi) => {
    const arr = Array.from(capitalsPerYear[yi]).sort((a, b) => a - b)
    return { calYear, p10: percentile(arr, 10), p25: percentile(arr, 25), p50: percentile(arr, 50), p75: percentile(arr, 75), p90: percentile(arr, 90) }
  })

  // Sample paths (first 100 sims)
  const N_SAMPLE = Math.min(100, sims)
  const samplePaths = Array.from({ length: N_SAMPLE }, (_, s) =>
    Array.from({ length: calYears.length }, (_, yi) => capitalsPerYear[yi][s])
  )

  // Final capital distribution
  const lastYi = calYears.length - 1
  const finalCapitals = Array.from(capitalsPerYear[lastYi])

  // Heatmap: every 3rd year, 25 capital buckets
  const BUCKETS = 25
  const HEAT_STEP = 3
  const maxCap = Math.max(...fan.map(f => f.p90)) * 1.1 || 1
  const bucketSize = maxCap / BUCKETS
  const heatmapData = calYears
    .filter((_, i) => i % HEAT_STEP === 0)
    .map((calYear, hyi) => {
      const yi = hyi * HEAT_STEP
      const counts = new Array(BUCKETS).fill(0)
      for (let s = 0; s < sims; s++) {
        const b = Math.min(BUCKETS - 1, Math.floor(capitalsPerYear[yi][s] / bucketSize))
        counts[b]++
      }
      return { calYear, counts }
    })

  return {
    successRate: (survived / sims) * 100,
    medianAtEnd: fan[fan.length - 1].p50,
    fan, sims, endYear: endCalYear,
    samplePaths, calYears, finalCapitals,
    heatmapData, bucketSize, maxCap, BUCKETS,
  }
}

// Success rate as a function of monthly spend (13 levels centred on baseSpend)
export function householdSuccessRateBySpend(p1, p2, baseSpend, p2GrossSalary, p1GrossSalary, p1schedule, p2schedule, baseCalYear, survivorFraction = 0.5) {
  const SIM = 1000
  const mean = p1.returnRate, std = 0.15
  const startCalYear = baseCalYear ?? (p1.birthYear + p1.currentAge)
  const endCalYear = p2.birthYear + p2.lifeExpectancy
  const p1DeathCalYear = p1.birthYear + p1.lifeExpectancy
  const inf = p1.inflation
  const p1ByAge = {}; for (const r of p1schedule) p1ByAge[r.age] = r
  const p2ByAge = {}; for (const r of p2schedule) p2ByAge[r.age] = r

  const calYearsArr = []
  for (let y = startCalYear; y <= endCalYear; y++) calYearsArr.push(y)

  const fixedData = calYearsArr.map((calYear) => {
    const p1Age = calYear - p1.birthYear
    const p2Age = calYear - p2.birthYear
    const p1Alive = p1Age <= p1.lifeExpectancy
    const p2Alive = p2Age <= p2.lifeExpectancy
    const p1Working = p1Alive && p1Age < p1.fireAge
    const p2Working = p2Alive && p2Age < p2.fireAge
    const inflFactor = Math.pow(1 + inf, calYear - startCalYear)
    const p1Sal = p1Working && p1GrossSalary > 0 ? swedenSalaryTax(p1GrossSalary * inflFactor, p1.kommunRate, p1Age).netto : 0
    const p2Sal = p2Working && p2GrossSalary > 0 ? swedenSalaryTax(p2GrossSalary * inflFactor, p2.kommunRate, p2Age).netto : 0
    const p1Row = p1Alive && !p1Working ? p1ByAge[p1Age] : null
    const p2Row = p2Alive && !p2Working ? p2ByAge[p2Age] : null
    const fixedIncome = (p1Row ? p1Row.pensionNetto : 0) + p1Sal + (p2Row ? p2Row.pensionNetto : 0) + p2Sal
    const p1Saving = p1Working && p1Age >= p1.monthlySavingsFrom && p1Age < p1.monthlySavingsTo ? p1.monthlySavings * 12 : 0
    const p2Saving = p2Working && p2Age >= p2.monthlySavingsFrom && p2Age < p2.monthlySavingsTo ? p2.monthlySavings * 12 : 0
    return { fixedIncome, inflFactor, p1Saving, p2Saving, isInheritanceYear: calYear === p1DeathCalYear + 1 }
  })

  const step = Math.round(baseSpend * 0.1 / 1000) * 1000 || 5000
  const spendLevels = Array.from({ length: 13 }, (_, i) => baseSpend - 6 * step + i * step).filter(s => s > 0)
  const startCapP1 = p1.iskValue + p1.ppValue
  const startCapP2 = p2.iskValue + p2.ppValue

  return spendLevels.map(spend => {
    const yearData = fixedData.map(d => ({
      ...d,
      iskAnnual: Math.max(0, spend * d.inflFactor - d.fixedIncome) * 12,
    }))
    let survived = 0
    for (let s = 0; s < SIM; s++) {
      let capP1 = startCapP1, capP2 = startCapP2
      for (const yd of yearData) {
        if (yd.isInheritanceYear && capP1 > 0) { capP2 += capP1 * survivorFraction; capP1 = 0 }
        const r = randNormal(mean, std) - ISK_TAX_RATE
        const total = capP1 + capP2
        const p1Frac = total > 0 ? capP1 / total : 0
        capP1 = Math.max(0, capP1 * (1 + r) + yd.p1Saving - yd.iskAnnual * p1Frac)
        capP2 = Math.max(0, capP2 * (1 + r) + yd.p2Saving - yd.iskAnnual * (1 - p1Frac))
      }
      if (capP1 + capP2 > 0) survived++
    }
    return { spend, successRate: (survived / SIM) * 100 }
  })
}

// -----------------------------------------------------------------------------
// Formatting helpers
// -----------------------------------------------------------------------------
export function formatKr(value, opts = {}) {
  const v = Math.round(value || 0)
  return (
    new Intl.NumberFormat('sv-SE', {
      maximumFractionDigits: opts.decimals ?? 0,
    }).format(v) + (opts.suffix ?? ' kr')
  )
}

export function formatMkr(value) {
  return (
    (value / 1_000_000).toLocaleString('sv-SE', { maximumFractionDigits: 2 }) + ' Mkr'
  )
}
