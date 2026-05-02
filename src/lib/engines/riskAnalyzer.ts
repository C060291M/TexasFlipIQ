import type { PropertyInput, RehabResult, DealResult, RiskFlag } from '@/types';

const CLAY_ZIPS = ['787','786','785','788','782','783','784','750','751','752','760','761','767','768','757'];

const STR_RULES: Record<string, { level:'high'|'medium'|'low'; notes:string }> = {
  '787':{ level:'high',   notes:'Austin: Type 2 STR permits banned in residential zones. Only owner-occupied Type 1 allowed. Verify before closing.' },
  '786':{ level:'high',   notes:'Austin metro: subject to Austin ETJ STR rules in some areas. Verify city jurisdiction.' },
  '770':{ level:'low',    notes:'Houston: no citywide STR permit, but deed restrictions frequently prohibit STR. Check HOA covenants.' },
  '750':{ level:'medium', notes:'Dallas: STR permit required. Prohibited in single-family zones without variance.' },
  '782':{ level:'medium', notes:'San Antonio: STR permit required since 2022. Annual fees apply. Neighborhood notification required.' },
};

export function analyzeRisks(input: PropertyInput, rehab: RehabResult, deal: DealResult): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const { zipCode, yearBuilt, purchasePrice, arv, exitStrategy, condition, holdingMonths } = input;
  const hasClayRisk = CLAY_ZIPS.some(p => zipCode.startsWith(p));

  if (hasClayRisk && yearBuilt < 1975) {
    flags.push({ id:'foundation-clay-old', severity:'danger', category:'foundation', title:'High foundation risk', description:`Expansive clay soil + pre-1975 construction. High incidence of foundation movement in this area.`, mitigation:'Commission a Level 1 engineer report ($350–$500) before closing. Budget $12k–$30k contingency.', estimatedImpact:18000 });
  } else if (hasClayRisk && yearBuilt < 1990) {
    flags.push({ id:'foundation-clay-moderate', severity:'warning', category:'foundation', title:'Moderate foundation risk', description:`Clay soil region with 1975–1990 construction. Have foundation inspected before closing.`, mitigation:'Minor repair (1–3 piers) $2k–$6k. Major repair up to $20k.', estimatedImpact:6000 });
  }

  if (exitStrategy === 'flip' && deal.flip) {
    const flip = deal.flip;
    if (flip.roi < 10) {
      flags.push({ id:'flip-thin-margin', severity:'danger', category:'financial', title:'Dangerously thin margins', description:`ROI of ${flip.roi.toFixed(1)}% leaves almost no buffer for overruns. Minimum target for HML deals is 15–20%.`, mitigation:'Renegotiate price by 8–12% or reduce rehab scope.', estimatedImpact:flip.netProfit });
    } else if (flip.roi < 15) {
      flags.push({ id:'flip-marginal-roi', severity:'warning', category:'financial', title:'Below-target ROI', description:`ROI of ${flip.roi.toFixed(1)}% is below the 15–20% target for hard money deals.`, mitigation:'Tighten bid process. Get 3 contractor bids. Build 10% contingency.' });
    }
    if (purchasePrice > flip.maxAllowableOffer * 1.05) {
      flags.push({ id:'flip-70-rule', severity:'warning', category:'market', title:'Purchase price exceeds 70% rule MAO', description:`Price ($${purchasePrice.toLocaleString()}) exceeds MAO of $${flip.maxAllowableOffer.toLocaleString()}.`, mitigation:'Negotiate price down or verify ARV with 3 recent closed comps within 0.5 miles.', estimatedImpact:purchasePrice - flip.maxAllowableOffer });
    }
    if (holdingMonths > 8) {
      flags.push({ id:'flip-long-hold', severity:'warning', category:'financial', title:'Extended hold period', description:`${holdingMonths}-month hold adds $${(deal.loan.monthlyInterest * Math.max(0, holdingMonths - 6)).toLocaleString()} in extra interest vs 6-month target.`, mitigation:'Scope rehab to complete in 5–6 months. Add contractor penalty clauses for delays.' });
    }
  }

  if ((exitStrategy === 'str' || exitStrategy === 'ltr') && deal.rental) {
    const rental = deal.rental;
    if (rental.annualCashFlow < 0) {
      flags.push({ id:'rental-negative-cf', severity:'danger', category:'financial', title:'Negative cash flow', description:`This deal loses $${Math.abs(rental.annualCashFlow).toLocaleString()}/year. You write a check every month.`, mitigation:'Reduce rehab cost, renegotiate purchase price, or increase down payment.', estimatedImpact:Math.abs(rental.annualCashFlow) });
    } else if (rental.annualCashFlow < 3600) {
      flags.push({ id:'rental-thin-cf', severity:'warning', category:'financial', title:'Thin cash flow buffer', description:`$${rental.monthlyCashFlow}/month leaves little buffer for CapEx or vacancy.`, mitigation:'Plan a CapEx reserve of 5–8% of gross rent annually.' });
    }
    if (rental.dscr < 1.0) {
      flags.push({ id:'rental-dscr', severity:'danger', category:'financial', title:'DSCR below 1.0', description:`DSCR of ${rental.dscr.toFixed(2)} means NOI doesn't cover debt. Lenders require 1.20–1.25 minimum.`, mitigation:'Review rent estimates. Reduce purchase price or rehab budget.' });
    }
  }

  const rehabToArv = rehab.total / arv;
  if (rehabToArv > 0.38) {
    flags.push({ id:'rehab-over-improvement', severity:'danger', category:'rehab', title:'Over-improvement risk', description:`Rehab is ${(rehabToArv*100).toFixed(0)}% of ARV. Exceeding 30% makes cost recovery difficult.`, mitigation:'Pull comps to verify ARV ceiling. Reduce scope to high-ROI items only.', estimatedImpact:Math.round(rehab.total * 0.15) });
  } else if (rehabToArv > 0.30) {
    flags.push({ id:'rehab-high-ratio', severity:'warning', category:'rehab', title:'Rehab-to-ARV elevated', description:`Rehab is ${(rehabToArv*100).toFixed(0)}% of ARV. Target under 25–28%.`, mitigation:'Verify ARV is conservative — compare to lowest sold comp.' });
  }

  if (exitStrategy === 'str') {
    let strRule = { level:'low' as const, notes:'No known major STR restrictions. Always verify current local ordinances.' };
    for (const [prefix, rule] of Object.entries(STR_RULES)) {
      if (zipCode.startsWith(prefix)) { strRule = rule; break; }
    }
    flags.push({ id:`str-reg-${strRule.level}`, severity:strRule.level === 'high' ? 'danger' : strRule.level === 'medium' ? 'warning' : 'info', category:'regulatory', title:strRule.level === 'high' ? 'High STR regulatory risk' : strRule.level === 'medium' ? 'STR permit required' : 'Verify STR regulations', description:strRule.notes, mitigation:'Contact city planning department before closing.' });
  }

  if (condition === 'gut') {
    flags.push({ id:'gut-scope-creep', severity:'warning', category:'rehab', title:'Gut rehab scope creep risk', description:'Gut rehabs regularly exceed budget by 15–30% due to hidden issues found after demo.', mitigation:`Your contingency of $${rehab.lineItems.contingency.toLocaleString()} should cover standard overruns. Consider a pre-demo inspection.` });
  }

  if (!flags.length) {
    flags.push({ id:'no-risks', severity:'info', category:'market', title:'No major risk flags detected', description:'Deal structure looks sound. Standard due diligence still applies: title search, inspection, contractor bids, and ARV verification.' });
  }

  return flags;
}
