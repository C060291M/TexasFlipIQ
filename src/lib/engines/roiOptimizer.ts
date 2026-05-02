import type { PropertyInput, RehabResult, DealResult, RehabRecommendation, CompsResult } from '@/types';
import { getBudgetAllocationTargets } from '@/lib/engines/rehabEngine';

const ROI_MULT: Record<string, Record<string, number>> = {
  flip: { kitchen:1.75, bathrooms:1.55, flooring:1.80, roof:1.05, hvac:1.10, electrical:1.00, plumbing:1.00, paint:2.10, foundation:0.80, landscaping:1.50, windows:1.20, doors:1.35 },
  str:  { kitchen:2.20, bathrooms:2.00, flooring:1.60, roof:1.00, hvac:1.20, electrical:1.30, plumbing:1.00, paint:1.80, foundation:0.80, landscaping:2.50, windows:1.15, doors:1.40, furnishing:3.20, hotTub:4.00 },
  ltr:  { kitchen:1.10, bathrooms:1.05, flooring:1.35, roof:1.00, hvac:1.15, electrical:1.00, plumbing:1.05, paint:1.40, foundation:0.85, landscaping:1.00, windows:1.10, doors:1.05 },
};

const ALLOC_PCT: Record<string, Record<string, [number, number]>> = {
  flip: { kitchen:[22,32], bathrooms:[15,24], flooring:[10,18], roof:[5,12], hvac:[5,10], paint:[5,9], landscaping:[4,9] },
  str:  { kitchen:[22,32], bathrooms:[15,22], flooring:[8,15], landscaping:[8,15], furnishing:[12,22], paint:[5,10] },
  ltr:  { flooring:[18,28], hvac:[15,25], kitchen:[14,22], bathrooms:[12,20], paint:[6,11] },
};

export function generateRecommendations(input: PropertyInput, rehab: RehabResult, deal: DealResult, comps?: CompsResult): RehabRecommendation[] {
  const { exitStrategy, arv } = input;
  const recs: RehabRecommendation[] = [];
  const roiTable = ROI_MULT[exitStrategy] || ROI_MULT.flip;
  const allocTable = ALLOC_PCT[exitStrategy] || ALLOC_PCT.flip;
  const total = rehab.total;

  for (const [item, [minPct, maxPct]] of Object.entries(allocTable)) {
    const current = (rehab.lineItems as Record<string, number>)[item] || 0;
    if (!current) continue;
    const currentPct = (current / total) * 100;
    const roiMult = roiTable[item] || 1.0;
    const midPct = (minPct + maxPct) / 2;
    const targetAmount = Math.round(total * (midPct / 100));

    if (currentPct < minPct && roiMult > 1.4) {
      const delta = targetAmount - current;
      recs.push({ category: item as any, action:'increase', currentAmount:current, suggestedAmount:targetAmount, delta, estimatedArvImpact:Math.round(delta * roiMult), rationale:`${item} is at ${currentPct.toFixed(0)}% of budget — below the ${minPct}–${maxPct}% target. Each $1 here returns ~$${roiMult.toFixed(2)} in value.`, priority: roiMult > 1.8 ? 'high' : 'medium' });
    }
    if (currentPct > maxPct && roiMult < 1.2) {
      const suggested = Math.round(total * (maxPct / 100));
      const delta = suggested - current;
      recs.push({ category: item as any, action:'decrease', currentAmount:current, suggestedAmount:suggested, delta, estimatedArvImpact:Math.round(Math.abs(delta) * roiMult * 0.3) * -1, rationale:`${item} is at ${currentPct.toFixed(0)}% — above the ${minPct}–${maxPct}% target. ROI on marginal spend here is only $${roiMult.toFixed(2)}/dollar.`, priority: Math.abs(delta) > 5000 ? 'high' : 'medium' });
    }
  }

  if (exitStrategy === 'flip') {
    const paintPsf = (rehab.lineItems.paint || 0) / input.sqft;
    if (paintPsf < 1.80) {
      const suggested = Math.round(input.sqft * 2.00);
      const delta = suggested - (rehab.lineItems.paint || 0);
      recs.push({ category:'paint', action:'increase', currentAmount:rehab.lineItems.paint||0, suggestedAmount:suggested, delta, estimatedArvImpact:Math.round(delta * 2.10), rationale:'Fresh neutral paint delivers $2.10 return per $1 — highest ROI in residential flips. Non-negotiable for top-dollar sale.', priority:'high' });
    }
    if (comps) {
      const maxComp = Math.max(...comps.saleComps.map(c => c.soldPrice));
      if (arv > maxComp * 1.08) {
        recs.push({ category:'kitchen', action:'decrease', currentAmount:rehab.lineItems.kitchen, suggestedAmount:Math.round(rehab.lineItems.kitchen * 0.80), delta:Math.round(rehab.lineItems.kitchen * -0.20), estimatedArvImpact:0, rationale:`ARV exceeds highest comp ($${maxComp.toLocaleString()}) by 8%+. Buyers won't pay above neighborhood ceiling. Reduce kitchen scope by 20%.`, priority:'high' });
      }
    }
  }

  if (exitStrategy === 'str') {
    if ((rehab.lineItems.landscaping || 0) < 5000 && input.sqft > 1200) {
      recs.push({ category:'landscaping', action:'increase', currentAmount:rehab.lineItems.landscaping||0, suggestedAmount:8500, delta:8500-(rehab.lineItems.landscaping||0), estimatedArvImpact:0, estimatedRentImpact:25, rationale:'Outdoor entertaining space is the #1 ADR driver for TX STR. Covered patio + fire pit ($5k–$9k) can add $15–$30/night.', priority:'high' });
    }
    if (!rehab.lineItems.hotTub && input.sqft > 1400) {
      recs.push({ category:'hotTub' as any, action:'increase', currentAmount:0, suggestedAmount:9500, delta:9500, estimatedArvImpact:0, estimatedRentImpact:30, rationale:'Hot tub (~$9,500) increases TX STR ADR by 18–30%. Typical payback period 14–20 months at average occupancy.', priority:'medium' });
    }
  }

  if (exitStrategy === 'ltr') {
    if ((rehab.lineItems.hvac || 0) < 4000 && input.yearBuilt < 2000) {
      recs.push({ category:'hvac', action:'increase', currentAmount:rehab.lineItems.hvac||0, suggestedAmount:6500, delta:6500-(rehab.lineItems.hvac||0), estimatedArvImpact:0, estimatedRentImpact:50, rationale:'HVAC is the #1 emergency call driver. Replacing pre-lease costs 40% less than reactive repair and eliminates tenant frustration in TX heat.', priority:'high' });
    }
    const floorPsf = (rehab.lineItems.flooring || 0) / input.sqft;
    if (floorPsf < 4.5) {
      const suggested = Math.round(input.sqft * 5.50);
      recs.push({ category:'flooring', action:'increase', currentAmount:rehab.lineItems.flooring||0, suggestedAmount:suggested, delta:suggested-(rehab.lineItems.flooring||0), estimatedArvImpact:0, estimatedRentImpact:75, rationale:'LVP throughout eliminates carpet replacement ($800–$2,500/turnover). Commercial-grade LVP lasts 20+ years.', priority:'medium' });
    }
  }

  return recs.sort((a, b) => ({ high:0, medium:1, low:2 }[a.priority] - { high:0, medium:1, low:2 }[b.priority])).slice(0, 6);
}
