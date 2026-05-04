import type {
  PropertyInput, RehabResult, RehabLineItems,
  FinishLevel, RegionalPricing,
} from '@/types';

export const REGIONAL_PRICING: RegionalPricing[] = [
  { region:'austin',      regionLabel:'Austin Metro',      zipPrefixes:['787','786','788'],                                    laborMultiplier:1.28, materialMultiplier:1.12, lastUpdated:'2025-01-15', dataSource:'TX Contractors Association' },
  { region:'other',       regionLabel:'Rio Grande Valley', zipPrefixes:['785'],                                               laborMultiplier:0.90, materialMultiplier:1.03, lastUpdated:'2025-01-15', dataSource:'TX Contractors Association' },
  { region:'houston',     regionLabel:'Houston Metro',     zipPrefixes:['770','771','772','773','774','775'],                  laborMultiplier:1.15, materialMultiplier:1.08, lastUpdated:'2025-01-15', dataSource:'TX Contractors Association' },
  { region:'east_texas',  regionLabel:'Beaumont',          zipPrefixes:['776','777'],                                         laborMultiplier:1.05, materialMultiplier:1.04, lastUpdated:'2025-01-15', dataSource:'TX Contractors Association' },
  { region:'dfw',         regionLabel:'Dallas Metro',      zipPrefixes:['750','751','752','753','754','755','758','759'],      laborMultiplier:1.20, materialMultiplier:1.10, lastUpdated:'2025-01-15', dataSource:'TX Contractors Association' },
  { region:'dfw',         regionLabel:'Fort Worth',        zipPrefixes:['760','761','762'],                                   laborMultiplier:1.18, materialMultiplier:1.08, lastUpdated:'2025-01-15', dataSource:'TX Contractors Association' },
  { region:'other',       regionLabel:'Waco',              zipPrefixes:['766','767'],                                         laborMultiplier:1.02, materialMultiplier:1.02, lastUpdated:'2025-01-15', dataSource:'TX Contractors Association' },
  { region:'san_antonio', regionLabel:'San Antonio',       zipPrefixes:['782','783','784'],                                   laborMultiplier:1.12, materialMultiplier:1.05, lastUpdated:'2025-01-15', dataSource:'TX Contractors Association' },
  { region:'other',       regionLabel:'South Texas',       zipPrefixes:['780','781','789'],                                   laborMultiplier:1.05, materialMultiplier:1.03, lastUpdated:'2025-01-15', dataSource:'TX Contractors Association' },
  { region:'east_texas',  regionLabel:'East Texas',        zipPrefixes:['716','717'],                                         laborMultiplier:0.96, materialMultiplier:1.02, lastUpdated:'2025-01-15', dataSource:'TX Contractors Association' },
  { region:'east_texas',  regionLabel:'Tyler / Longview',  zipPrefixes:['756','757'],                                         laborMultiplier:0.97, materialMultiplier:1.02, lastUpdated:'2025-01-15', dataSource:'TX Contractors Association' },
  { region:'panhandle',   regionLabel:'Amarillo',          zipPrefixes:['790','791'],                                         laborMultiplier:0.94, materialMultiplier:1.04, lastUpdated:'2025-01-15', dataSource:'TX Contractors Association' },
  { region:'other',       regionLabel:'Lubbock',           zipPrefixes:['794'],                                               laborMultiplier:0.93, materialMultiplier:1.03, lastUpdated:'2025-01-15', dataSource:'TX Contractors Association' },
  { region:'west_texas',  regionLabel:'El Paso',           zipPrefixes:['798','799'],                                         laborMultiplier:0.92, materialMultiplier:1.05, lastUpdated:'2025-01-15', dataSource:'TX Contractors Association' },
  { region:'west_texas',  regionLabel:'West Texas',        zipPrefixes:['792','793','795','796','797'],                       laborMultiplier:0.92, materialMultiplier:1.06, lastUpdated:'2025-01-15', dataSource:'TX Contractors Association' },
];

export function getRegionalPricing(zipCode: string): RegionalPricing {
  const zip = zipCode.toString().trim();
  const candidates: Array<{ prefix: string; region: RegionalPricing }> = [];
  for (const region of REGIONAL_PRICING) {
    for (const prefix of region.zipPrefixes) {
      candidates.push({ prefix, region });
    }
  }
  candidates.sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix, region } of candidates) {
    if (zip.startsWith(prefix)) return region;
  }
  return {
    region: 'other',
    regionLabel: 'Texas (General)',
    zipPrefixes: [],
    laborMultiplier: 1.00,
    materialMultiplier: 1.00,
    lastUpdated: '2025-01-15',
    dataSource: 'TX average estimate',
  };
}

function getAgeMultiplier(yearBuilt: number): number {
  if (yearBuilt < 1950) return 1.28;
  if (yearBuilt < 1970) return 1.20;
  if (yearBuilt < 1980) return 1.14;
  if (yearBuilt < 1990) return 1.08;
  if (yearBuilt < 2000) return 1.04;
  if (yearBuilt < 2010) return 1.01;
  return 1.00;
}

// ── BASE COSTS by condition ───────────────────────────────────
// Light    = cosmetic only   (paint, floors, doors, landscaping, minor kitchen/bath touch-up)
// Moderate = systems + cosmetic (adds roof, HVAC, electrical, plumbing, windows)
// Heavy    = major systems   (full systems replacement + cosmetic)
// Gut      = full rehab      (everything including foundation)

interface BaseCost {
  kitchen:    { base: number };
  bathrooms:  { base: number; perBath: number };
  flooring:   { perSqft: number };
  roof:       { base: number; perSqft: number };
  hvac:       { base: number; perSqft: number };
  electrical: { base: number; perSqft: number };
  plumbing:   { base: number; perSqft: number };
  paint:      { perSqft: number };
  foundation: { base: number };
  landscaping:{ base: number };
  windows:    { perUnit: number; avgUnits: number };
  doors:      { perUnit: number; avgUnits: number };
}

const BASE_COSTS: Record<string, BaseCost> = {
  // LIGHT — cosmetic only
  // No roof, HVAC, electrical, plumbing, windows
  // Small kitchen/bath cosmetic touch-up only
  light: {
    kitchen:    { base: 3500 },
    bathrooms:  { base: 1800, perBath: 800 },
    flooring:   { perSqft: 3.00 },
    roof:       { base: 0, perSqft: 0 },
    hvac:       { base: 0, perSqft: 0 },
    electrical: { base: 0, perSqft: 0 },
    plumbing:   { base: 0, perSqft: 0 },
    paint:      { perSqft: 1.10 },
    foundation: { base: 0 },
    landscaping:{ base: 1500 },
    windows:    { perUnit: 0, avgUnits: 0 },
    doors:      { perUnit: 200, avgUnits: 4 },
  },
  // MODERATE — systems + cosmetic
  // Adds roof (partial), HVAC, electrical, plumbing, windows
  moderate: {
    kitchen:    { base: 16500 },
    bathrooms:  { base: 7800, perBath: 3500 },
    flooring:   { perSqft: 5.75 },
    roof:       { base: 4500, perSqft: 2.20 },
    hvac:       { base: 5200, perSqft: 0.60 },
    electrical: { base: 3500, perSqft: 0.80 },
    plumbing:   { base: 2800, perSqft: 0.30 },
    paint:      { perSqft: 1.85 },
    foundation: { base: 0 },
    landscaping:{ base: 2800 },
    windows:    { perUnit: 380, avgUnits: 6 },
    doors:      { perUnit: 350, avgUnits: 6 },
  },
  // HEAVY — major systems replacement
  heavy: {
    kitchen:    { base: 29000 },
    bathrooms:  { base: 13500, perBath: 5500 },
    flooring:   { perSqft: 7.80 },
    roof:       { base: 0, perSqft: 4.80 },
    hvac:       { base: 8500, perSqft: 1.10 },
    electrical: { base: 8000, perSqft: 1.50 },
    plumbing:   { base: 7500, perSqft: 0.80 },
    paint:      { perSqft: 2.50 },
    foundation: { base: 6500 },
    landscaping:{ base: 4500 },
    windows:    { perUnit: 480, avgUnits: 10 },
    doors:      { perUnit: 480, avgUnits: 8 },
  },
  // GUT — full rehab, everything
  gut: {
    kitchen:    { base: 44000 },
    bathrooms:  { base: 20000, perBath: 8000 },
    flooring:   { perSqft: 10.20 },
    roof:       { base: 0, perSqft: 5.50 },
    hvac:       { base: 12500, perSqft: 1.60 },
    electrical: { base: 14000, perSqft: 2.20 },
    plumbing:   { base: 13000, perSqft: 1.20 },
    paint:      { perSqft: 3.10 },
    foundation: { base: 14000 },
    landscaping:{ base: 6500 },
    windows:    { perUnit: 550, avgUnits: 14 },
    doors:      { perUnit: 580, avgUnits: 10 },
  },
};

const STRATEGY_MULTIPLIERS: Record<string, Record<string, number>> = {
  flip: {
    kitchen:1.30, bathrooms:1.22, flooring:1.18, roof:1.00, hvac:1.00,
    electrical:1.00, plumbing:1.00, paint:1.12, foundation:1.00,
    landscaping:1.25, windows:1.15, doors:1.20,
  },
  str: {
    kitchen:1.50, bathrooms:1.45, flooring:1.28, roof:1.00, hvac:1.10,
    electrical:1.15, plumbing:1.05, paint:1.30, foundation:1.00,
    landscaping:1.40, windows:1.20, doors:1.30,
  },
  ltr: {
    kitchen:0.80, bathrooms:0.82, flooring:0.88, roof:1.00, hvac:1.00,
    electrical:0.95, plumbing:0.95, paint:0.88, foundation:1.00,
    landscaping:0.70, windows:0.95, doors:0.90,
  },
};

export function calculateRehab(input: PropertyInput): RehabResult {
  const {
    sqft, yearBuilt, zipCode, condition,
    exitStrategy, bathrooms, hasFoundationIssues, customRehabItems,
  } = input;

  const base      = BASE_COSTS[condition] || BASE_COSTS.moderate;
  const regional  = getRegionalPricing(zipCode);
  const stratMult = STRATEGY_MULTIPLIERS[exitStrategy] || STRATEGY_MULTIPLIERS.flip;
  const ageMult   = getAgeMultiplier(yearBuilt);
  const laborM    = regional.laborMultiplier;
  const materialM = regional.materialMultiplier;
  const sqftRatio = sqft / 1500;

  const calc: Record<string, number> = {
    kitchen:
      base.kitchen.base * stratMult.kitchen * laborM * ageMult,
    bathrooms:
      (base.bathrooms.base + base.bathrooms.perBath * Math.max(0, bathrooms - 1))
      * stratMult.bathrooms * laborM * ageMult,
    flooring:
      base.flooring.perSqft * sqft * stratMult.flooring * materialM,
    roof:
      (base.roof.base + base.roof.perSqft * sqft)
      * stratMult.roof * laborM * ageMult,
    hvac:
      (base.hvac.base + base.hvac.perSqft * sqft)
      * stratMult.hvac * laborM * ageMult,
    electrical:
      (base.electrical.base + base.electrical.perSqft * sqft)
      * stratMult.electrical * laborM * ageMult,
    plumbing:
      (base.plumbing.base + base.plumbing.perSqft * sqft)
      * stratMult.plumbing * laborM * ageMult,
    paint:
      base.paint.perSqft * sqft * stratMult.paint * laborM,
    // Foundation: always shows for heavy/gut; shows for light/moderate only if checkbox checked
    foundation:
      (base.foundation.base > 0 || hasFoundationIssues)
        ? (base.foundation.base + (hasFoundationIssues ? 8000 : 0)) * laborM
        : 0,
    landscaping:
      base.landscaping.base * sqftRatio * stratMult.landscaping * laborM,
    windows:
      base.windows.perUnit * base.windows.avgUnits
      * stratMult.windows * materialM,
    doors:
      base.doors.perUnit * base.doors.avgUnits
      * stratMult.doors * materialM,
  };

  // Pool — add if property has existing pool needing work, or condition is heavy/gut
  calc.pool = input.hasPool
    ? (condition === 'light' ? 2500 :
       condition === 'moderate' ? 6500 :
       condition === 'heavy' ? 14000 : 22000) * laborM
    : 0;
  if (customRehabItems) Object.assign(calc, customRehabItems);

  const furnishing = exitStrategy === 'str' ? sqft * 11 * materialM : 0;
  const hotTub     = exitStrategy === 'str' && sqft > 1200 ? 8500 * laborM : 0;
  const subtotal   = Object.values(calc).reduce((a, b) => a + b, 0) + furnishing + hotTub;
  const contingencyRate = (condition === 'light' || condition === 'moderate') ? 0.10 : 0.15;
  const contingency = subtotal * contingencyRate;

  const lineItems: RehabLineItems = {
    kitchen:     Math.round(calc.kitchen),
    bathrooms:   Math.round(calc.bathrooms),
    flooring:    Math.round(calc.flooring),
    roof:        Math.round(calc.roof),
    hvac:        Math.round(calc.hvac),
    electrical:  Math.round(calc.electrical),
    plumbing:    Math.round(calc.plumbing),
    paint:       Math.round(calc.paint),
    foundation:  Math.round(calc.foundation),
    landscaping: Math.round(calc.landscaping),
    windows:     Math.round(calc.windows),
    doors:       Math.round(calc.doors),
    ...(calc.pool > 0 && { pool: Math.round(calc.pool) }),
    contingency: Math.round(contingency),
    ...(furnishing > 0 && { furnishing: Math.round(furnishing) }),
    ...(hotTub > 0     && { hotTub:     Math.round(hotTub) }),
  };

  const total = Object.values(lineItems).reduce((a, b) => a + b, 0);
  const finishLevel: FinishLevel =
    exitStrategy === 'str' ? 'premium' :
    exitStrategy === 'flip' ? 'standard' : 'economy';

  return {
    lineItems,
    total:              Math.round(total),
    perSqft:            Math.round(total / sqft),
    region:             regional.region,
    regionLabel:        regional.regionLabel,
    laborMultiplier:    regional.laborMultiplier,
    ageMultiplier:      ageMult,
    strategyMultiplier:
      exitStrategy === 'flip' ? 1.18 :
      exitStrategy === 'str'  ? 1.30 : 0.88,
    finishLevel,
    pricingVersion: 'Q1-2025',
  };
}

export function getBudgetAllocationTargets(strategy: string): Record<string, number> {
  const flip: Record<string, number> = {
    Kitchen: 28, Bathrooms: 20, Flooring: 14,
    'Roof/Structural': 10, 'HVAC/Mech': 8,
    Paint: 7, Landscaping: 7, Windows: 3, Doors: 3,
  };
  const str: Record<string, number> = {
    Kitchen: 26, Bathrooms: 18, 'Furnishing/Decor': 16,
    Flooring: 12, 'Outdoor/Amenities': 10,
    Paint: 8, 'HVAC/Electrical': 6, Landscaping: 4,
  };
  const ltr: Record<string, number> = {
    Flooring: 22, 'HVAC/Roof': 22, Kitchen: 18,
    Bathrooms: 15, Electrical: 8, Paint: 8,
    Plumbing: 4, Landscaping: 3,
  };
  const map: Record<string, Record<string, number>> = { flip, str, ltr };
  return map[strategy] || map.flip;
}
