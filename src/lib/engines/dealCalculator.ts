import type { PropertyInput, RehabResult, DealResult, LoanDetails, TexasCosts, FlipResult, RentalResult, DealScore } from '@/types';

const TX_TAX_RATES: Record<string, number> = {
  '787':2.15,'786':2.10,'785':2.18,'77':2.30,'75':2.22,'76':2.28,'782':2.08,'783':2.05,'79':1.85,'73':1.78,
};

function getTaxRate(zipCode: string): number {
  const z = zipCode.toString();
  for (const [prefix, rate] of Object.entries(TX_TAX_RATES)) {
    if (z.startsWith(prefix)) return rate;
  }
  return 2.10;
}

function calcLoan(input: PropertyInput): LoanDetails {
  const { purchasePrice, hardMoneyRate, hardMoneyPoints, ltv, holdingMonths } = input;
  const loanAmount = purchasePrice * (ltv / 100);
  const originationFee = loanAmount * (hardMoneyPoints / 100);
  const monthlyInterest = loanAmount * (hardMoneyRate / 100 / 12);
  const totalInterest = monthlyInterest * holdingMonths;
  return { loanAmount:Math.round(loanAmount), originationFee:Math.round(originationFee), monthlyInterest:Math.round(monthlyInterest), totalInterest:Math.round(totalInterest), totalCarryingCost:Math.round(totalInterest + originationFee) };
}

function calcTexasCosts(input: PropertyInput): TexasCosts {
  const { purchasePrice, arv, zipCode, holdingMonths } = input;
  const taxRate = getTaxRate(zipCode);
  return {
    realtorCommission: Math.round(arv * 0.055),
    titleEscrowBuy:    Math.round(purchasePrice * 0.015),
    titleEscrowSell:   Math.round(arv * 0.010),
    propertyTax:       Math.round((arv * (taxRate / 100) / 12) * holdingMonths),
    insurance:         Math.round(145 * holdingMonths),
  };
}

function calcFlip(input: PropertyInput, rehab: RehabResult, loan: LoanDetails, txCosts: TexasCosts): FlipResult {
  const { purchasePrice, arv, holdingMonths } = input;
  const totalProjectCost = purchasePrice + rehab.total + loan.totalCarryingCost + txCosts.titleEscrowBuy + txCosts.propertyTax + txCosts.insurance;
  const netProfit = arv - totalProjectCost - txCosts.realtorCommission - txCosts.titleEscrowSell;
  const roi = (netProfit / totalProjectCost) * 100;
  return {
    grossProfit:        Math.round(arv - totalProjectCost),
    netProfit:          Math.round(netProfit),
    totalProjectCost:   Math.round(totalProjectCost),
    roi:                Math.round(roi * 10) / 10,
    profitMargin:       Math.round((netProfit / arv) * 1000) / 10,
    equityCreated:      Math.round(arv - totalProjectCost),
    maxAllowableOffer:  Math.round(arv * 0.70 - rehab.total),
    annualizedRoi:      Math.round((roi / holdingMonths) * 12 * 10) / 10,
  };
}

function calcRental(input: PropertyInput, rehab: RehabResult, loan: LoanDetails): RentalResult {
  const { purchasePrice, arv, sqft, zipCode, exitStrategy } = input;
  const isStr = exitStrategy === 'str';
  const isAustin = zipCode.startsWith('787') || zipCode.startsWith('786');
  let grossMonthlyRent: number;
  let projectedAdr: number | undefined;
  let occupancyRate: number | undefined;

  if (isStr) {
    const basePct = isAustin ? 0.0095 : 0.0082;
    grossMonthlyRent = Math.round(arv * basePct);
    projectedAdr = Math.round((grossMonthlyRent * 12) / 365);
    occupancyRate = isAustin ? 0.73 : 0.68;
  } else {
    const rentPct = zipCode.startsWith('787') ? 0.0070 : zipCode.startsWith('77') ? 0.0065 : zipCode.startsWith('75') ? 0.0068 : 0.0067;
    grossMonthlyRent = Math.round(arv * rentPct);
  }

  const annualGrossRent = grossMonthlyRent * 12;
  const expenseRatio = isStr ? 0.40 : 0.45;
  const operatingExpenses = Math.round(annualGrossRent * expenseRatio);
  const noi = annualGrossRent - operatingExpenses;
  const annualDebtService = loan.monthlyInterest * 12;
  const annualCashFlow = noi - annualDebtService;
  const equity = purchasePrice + rehab.total - loan.loanAmount;
  const cashOnCashReturn = (annualCashFlow / Math.max(equity, 1)) * 100;

  return {
    grossMonthlyRent, annualGrossRent, operatingExpenses,
    noi:              Math.round(noi),
    annualDebtService:Math.round(annualDebtService),
    annualCashFlow:   Math.round(annualCashFlow),
    monthlyCashFlow:  Math.round(annualCashFlow / 12),
    cashOnCashReturn: Math.round(cashOnCashReturn * 10) / 10,
    capRate:          Math.round((noi / arv) * 1000) / 10,
    grm:              Math.round((purchasePrice / annualGrossRent) * 10) / 10,
    dscr:             Math.round((noi / Math.max(annualDebtService, 1)) * 100) / 100,
    ...(projectedAdr !== undefined && { projectedAdr }),
    ...(occupancyRate !== undefined && { breakEvenOccupancy: Math.round((operatingExpenses * 0.4 + annualDebtService) / (projectedAdr! * 365) * 100) }),
  };
}

function calcDealScore(input: PropertyInput, rehab: RehabResult, flip?: FlipResult, rental?: RentalResult): DealScore {
  let returnScore = 0, buyPriceScore = 0, rehabRiskScore = 0, marketScore = 0;
  const { exitStrategy, purchasePrice, arv } = input;

  if (exitStrategy === 'flip' && flip) {
    if (flip.roi > 25) returnScore = 40; else if (flip.roi > 20) returnScore = 34; else if (flip.roi > 15) returnScore = 26; else if (flip.roi > 10) returnScore = 16; else if (flip.roi > 5) returnScore = 8;
    if (purchasePrice <= flip.maxAllowableOffer * 0.95) buyPriceScore = 25; else if (purchasePrice <= flip.maxAllowableOffer) buyPriceScore = 20; else if (purchasePrice <= flip.maxAllowableOffer * 1.05) buyPriceScore = 12; else if (purchasePrice <= flip.maxAllowableOffer * 1.10) buyPriceScore = 5;
  } else if (rental) {
    if (rental.cashOnCashReturn > 15) returnScore = 40; else if (rental.cashOnCashReturn > 12) returnScore = 34; else if (rental.cashOnCashReturn > 8
