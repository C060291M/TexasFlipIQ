export type PropertyCondition = 'light' | 'moderate' | 'heavy' | 'gut';
export type PropertyType = 'sfr' | 'duplex' | 'triplex' | 'fourplex' | 'condo' | 'townhome';
export type ExitStrategy = 'flip' | 'str' | 'ltr';
export type FinishLevel = 'economy' | 'standard' | 'premium' | 'luxury';
export type RiskSeverity = 'info' | 'warning' | 'danger';
export type TexasRegion = 'austin' | 'houston' | 'dfw' | 'san_antonio' | 'west_texas' | 'panhandle' | 'east_texas' | 'other';

export interface PropertyInput {
  // Location
  sqft: number;
  yearBuilt: number;
  zipCode: string;
  city?: string;
  address?: string;

  // Property details
  propertyType: PropertyType;
  condition: PropertyCondition;
  bedrooms: number;
  bathrooms: number;
  lotSize?: number;
  stories?: number;
  acreage?: number;

  // Property features
  hasPool?: boolean;
  isWaterfront?: boolean;
  hasGarage?: boolean;
  hasFoundationIssues?: boolean;

  // Exit strategy
  exitStrategy: ExitStrategy;

  // Deal financials
  purchasePrice: number;
  arv: number;
  holdingMonths: number;

  // Hard money
  hardMoneyRate: number;
  hardMoneyPoints: number;
  ltv: number;

  // Optional overrides
  finishLevel?: FinishLevel;
  customRehabItems?: Partial<RehabLineItems>;
}
}

export interface RehabLineItems {
  kitchen: number;
  bathrooms: number;
  flooring: number;
  roof: number;
  hvac: number;
  electrical: number;
  plumbing: number;
  paint: number;
  foundation: number;
  landscaping: number;
  windows: number;
  doors: number;
  furnishing?: number;
  hotTub?: number;
pool?: number;
  contingency: number;
  }

export interface RehabResult {
  lineItems: RehabLineItems;
  total: number;
  perSqft: number;
  region: TexasRegion;
  regionLabel: string;
  laborMultiplier: number;
  ageMultiplier: number;
  strategyMultiplier: number;
  finishLevel: FinishLevel;
  pricingVersion: string;
}

export interface LoanDetails {
  loanAmount: number;
  originationFee: number;
  monthlyInterest: number;
  totalInterest: number;
  totalCarryingCost: number;
}

export interface TexasCosts {
  realtorCommission: number;
  titleEscrowBuy: number;
  titleEscrowSell: number;
  propertyTax: number;
  insurance: number;
}

export interface FlipResult {
  grossProfit: number;
  netProfit: number;
  totalProjectCost: number;
  roi: number;
  profitMargin: number;
  equityCreated: number;
  maxAllowableOffer: number;
  annualizedRoi: number;
}

export interface RentalResult {
  grossMonthlyRent: number;
  annualGrossRent: number;
  operatingExpenses: number;
  noi: number;
  annualDebtService: number;
  annualCashFlow: number;
  monthlyCashFlow: number;
  cashOnCashReturn: number;
  capRate: number;
  grm: number;
  dscr: number;
  breakEvenOccupancy?: number;
  projectedAdr?: number;
}

export interface DealScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
  explanation: string;
  components: {
    returnScore: number;
    buyPriceScore: number;
    rehabRiskScore: number;
    marketScore: number;
  };
}

export interface DealResult {
  loan: LoanDetails;
  texasCosts: TexasCosts;
  totalInvestment: number;
  equityAtPurchase: number;
  flip?: FlipResult;
  rental?: RentalResult;
  dealScore: DealScore;
}

export interface RiskFlag {
  id: string;
  severity: RiskSeverity;
  category: 'foundation' | 'market' | 'financial' | 'regulatory' | 'rehab';
  title: string;
  description: string;
  mitigation?: string;
  estimatedImpact?: number;
}

export interface SaleComp {
  id: string;
  address: string;
  soldPrice: number;
  sqft: number;
  beds: number;
  baths: number;
  yearBuilt: number;
  daysOnMarket: number;
  soldDate: string;
  pricePerSqft: number;
  distanceMiles: number;
  source: 'mls' | 'attom' | 'propstream' | 'simulated';
}

export interface RentalComp {
  id: string;
  address: string;
  monthlyRent: number;
  sqft: number;
  beds: number;
  baths: number;
  type: 'ltr' | 'str';
  avgDailyRate?: number;
  occupancyRate?: number;
  annualRevenue?: number;
  source: 'zillow' | 'rentometer' | 'airdna' | 'simulated';
}

export interface CompsResult {
  saleComps: SaleComp[];
  rentalComps: RentalComp[];
  suggestedArv: number;
  arvConfidence: 'high' | 'medium' | 'low';
  arvRange: { low: number; high: number };
  suggestedRent: number;
  finishRecommendation: FinishLevel;
  neighborhoodNotes: string;
}

export interface RehabRecommendation {
  category: keyof RehabLineItems;
  action: 'increase' | 'decrease' | 'maintain';
  currentAmount: number;
  suggestedAmount: number;
  delta: number;
  estimatedArvImpact: number;
  estimatedRentImpact?: number;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
}

export interface RegionalPricing {
  region: TexasRegion;
  regionLabel: string;
  zipPrefixes: string[];
  laborMultiplier: number;
  materialMultiplier: number;
  lastUpdated: string;
  dataSource: string;
}
