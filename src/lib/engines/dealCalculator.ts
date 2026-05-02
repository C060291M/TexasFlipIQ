import type { PropertyInput, RehabResult, DealResult, LoanDetails, TexasCosts, FlipResult, RentalResult, DealScore } from '@/types';

const TX_TAX_RATES: Record<string, number> = {
  '787':2.15,'786':2.10,'785':2.18,'77':2.30,'75':2.22,'76':2.28,'782':2.08,'783':2.05,'79':1.85,'73':1.78,
};

function getTaxRate(zip: string): number {
  for (const [p, r] of Object.entries(TX_TAX_RATES)) {
    if (zip.startsWith(p)) return r;
  }
  return 2.10;
}

function calcLoan(input: PropertyInput): LoanDetails {
  const loan = input.purchasePrice * (input.ltv / 100);
  const fee  = loan * (input.hardMoneyPoints / 100);
  const mo   = loan * (input.hardMoneyRate / 100 / 12);
  const tot  = mo * input.holdingMonths;
  return {
    loanAmount: Math.round(loan),
    originationFee: Math.round(fee),
    monthlyInterest: Math.round(mo),
    totalInterest: Math.round(tot),
    totalCarryingCost: Math.round(tot + fee),
  };
}

function calcTexasCosts(input: PropertyInput): TexasCosts {
  const taxRate = getTaxRate(input.zipCode);
  return {
    realtorCommission: Math.round(input.arv * 0.055),
    titleEscrowBuy:    Math.round(input.purchasePrice * 0.015),
    titleEscrowSell:   Math.round(input.arv * 0.010),
    propertyTax:       Math.round((input.arv * (taxRate / 100) / 12) * input.holdingMonths),
    insurance:         Math.round(145 * input.holdingMonths),
  };
}

function calcFlip(input: PropertyInput, rehab: RehabResult, loan: LoanDetails, tx: TexasCosts): FlipResult {
  const totalCost = input.purchasePrice + rehab.total + loan.totalCarryingCost + tx.titleEscrowBuy + tx.propertyTax + tx.insurance;
  const netProfit = input.arv - totalCost - tx.realtorCommission - tx.titleEscrowSell;
  const roi = (netProfit / totalCost) * 100;
  const mao = input.arv * 0.70 - rehab.total;
  return {
    grossProfit:       Math.round(input.arv - totalCost),
    netProfit:         Math.round(netProfit),
    totalProjectCost:  Math.round(totalCost),
    roi:               Math.round(roi * 10) / 10,
    profitMargin:      Math.round((netProfit / input.arv) * 1000) / 10,
    equityCreated:     Math.round(input.arv - totalCost),
    maxAllowableOffer: Math.round(mao),
    annualizedRoi:     Math.round((roi / input.holdingMonths) * 12 * 10) / 10,
  };
}

function calcRental(input: PropertyInput, rehab: RehabResult, loan: LoanDetails): RentalResult {
  const isStr    = input.exitStrategy === 'str';
  const isAustin = input.zipCode.startsWith('787') || input.zipCode.startsWith('786');
  const rentPct  = input.zipCode.startsWith('787') ? 0.0070 : input.zipCode.startsWith('77') ? 0.0065 : input.zipCode.startsWith('75') ? 0.0068 : 0.0067;
  const strPct   = isAustin ? 0.0095 : 0.0082;
  const grossMo  = Math.round(input.arv * (isStr ? strPct : rentPct));
  const annGross = grossMo * 12;
  const expenses = Math.round(annGross * (isStr ? 0.40 : 0.45));
  const noi      = annGross - expenses;
  const debt     = loan.monthlyInterest * 12;
  const cf       = noi - debt;
  const equity   = input.purchasePrice + rehab.total - loan.loanAmount;
  const adr      = isStr ? Math.round((grossMo * 12) / 365) : undefined;
  const occ      = isStr ? (isAustin ? 0.73 : 0.68) : undefined;
  return {
    grossMonthlyRent:  grossMo,
    annualGrossRent:   annGross,
    operatingExpenses: expenses,
    noi:               Math.round(noi),
    annualDebtService: Math.round(debt),
    annualCashFlow:    Math.round(cf),
    monthlyCashFlow:   Math.round(cf / 12),
    cashOnCashReturn:  Math.round((cf / Math.max(equity, 1)) * 1000) / 10,
    capRate:           Math.round((noi / input.arv) * 1000) / 10,
    grm:               Math.round((input.purchasePrice / annGross) * 10) / 10,
    dscr:              Math.round((noi / Math.max(debt, 1)) * 100) / 100,
    ...(adr !== undefined && { projectedAdr: adr }),
    ...(occ !== undefined && { breakEvenOccupancy: Math.round((expenses * 0.4 + debt) / (adr! * 365) * 100) }),
  };
}

function calcScore(input: PropertyInput, rehab: RehabResult, flip?: FlipResult, rental?: RentalResult): DealScore {
  let rs = 0, bs = 0, rr = 0, ms = 0;

  if (input.exitStrategy === 'flip' && flip) {
    if (flip.roi > 25)      rs = 40;
    else if (flip.roi > 20) rs = 34;
    else if (flip.roi > 15) rs = 26;
    else if (flip.roi > 10) rs = 16;
    else if (flip.roi > 5)  rs = 8;

    if (input.purchasePrice <= flip.maxAllowableOffer * 0.95)      bs = 25;
    else if (input.purchasePrice <= flip.maxAllowableOffer)        bs = 20;
    else if (input.purchasePrice <= flip.maxAllowableOffer * 1.05) bs = 12;
    else if (input.purchasePrice <= flip.maxAllowableOffer * 1.10) bs = 5;
  }

  if (input.exitStrategy !== 'flip' && rental) {
    if (rental.cashOnCashReturn > 15)      rs = 40;
    else if (rental.cashOnCashReturn > 12) rs = 34;
    else if (rental.cashOnCashReturn > 8)  rs = 26;
    else if (rental.cashOnCashReturn > 5)  rs = 16;
    else if (rental.cashOnCashReturn > 2)  rs = 8;

    const allIn = input.purchasePrice + rehab.total;
    if (allIn < input.arv * 0.82)      bs = 25;
    else if (allIn < input.arv * 0.88) bs = 18;
    else if (allIn < input.arv * 0.93) bs = 10;
    else if (allIn < input.arv)        bs = 4;

    if (rental.dscr > 1.5)       ms += 5;
    else if (rental.dscr > 1.25) ms += 3;
  }

  const ratio = rehab.total / input.arv;
  if (ratio < 0.15)      rr = 20;
  else if (ratio < 0.22) rr = 16;
  else if (ratio < 0.30) rr = 10;
  else if (ratio < 0.38) rr = 4;

  const growth = ['787','786','785','75','77'];
  ms += growth.some(p => input.zipCode.startsWith(p)) ? 10 : 5;

  const score = Math.min(100, Math.max(0, rs + bs + rr + ms));
  const grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 45 ? 'C' : score >= 25 ? 'D' : 'F';
  const label = score >= 80 ? 'Strong deal' : score >= 65 ? 'Good deal' : score >= 45 ? 'Marginal' : score >= 25 ? 'Weak deal' : 'Pass';
  const pct   = ((rehab.total / input.arv) * 100).toFixed(0);
  const expl  = input.exitStrategy === 'flip'
    ? `Flip score based on net ROI (${flip?.roi.toFixed(1)}%), 70% rule compliance, and rehab-to-ARV ratio (${pct}%).`
    : `Rental score based on cash-on-cash return (${rental?.cashOnCashReturn.toFixed(1)}%), equity at purchase, and DSCR (${rental?.dscr.toFixed(2)}).`;

  return { score, grade, label, explanation: expl, components: { returnScore:rs, buyPriceScore:bs, rehabRiskScore:rr, marketScore:ms } };
}

export function calculateDeal(input: PropertyInput, rehab: RehabResult): DealResult {
  const loan = calcLoan(input);
  const tx   = calcTexasCosts(input);
  const flip   = input.exitStrategy === 'flip' ? calcFlip(input, rehab, loan, tx) : undefined;
  const rental = input.exitStrategy !== 'flip' ? calcRental(input, rehab, loan) : undefined;
  const total  = input.purchasePrice + rehab.total + loan.totalCarryingCost + tx.titleEscrowBuy + tx.propertyTax + tx.insurance;
  return {
    loan, texasCosts: tx,
    totalInvestment:  Math.round(total),
    equityAtPurchase: Math.round(input.arv - total),
    flip, rental,
    dealScore: calcScore(input, rehab, flip, rental),
  };
}

export function sensitivityAnalysis(input: PropertyInput, rehab: RehabResult) {
  return [-15,-10,-5,0,5,10,15].map(d => {
    const adj  = { ...input, arv: input.arv * (1 + d / 100) };
    const deal = calculateDeal(adj, rehab);
    return { arvDelta:d, arv:Math.round(adj.arv), netProfit:deal.flip?.netProfit, cashFlow:deal.rental?.annualCashFlow, roi:deal.flip?.roi ?? deal.rental?.cashOnCashReturn };
  });
}
