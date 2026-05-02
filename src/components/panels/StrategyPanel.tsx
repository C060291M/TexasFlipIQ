'use client';

import type { PropertyInput, RehabResult, DealResult, RehabRecommendation } from '@/types';
import { getBudgetAllocationTargets } from '@/lib/engines/rehabEngine';

const fmt = (n: number) => '$' + Math.round(n).toLocaleString();

const SCOPES: Record<string, string[]> = {
  flip: ['High-ROI visual upgrades — kitchen, baths, curb appeal','Mid-to-high finishes — match or exceed neighborhood standard','Avoid over-improving beyond comparable sales price ceiling','New fixtures, paint, LVP flooring — maximum visual impact per dollar','Fresh landscaping and exterior paint for street appeal'],
  str:  ['"Instagrammable" premium finishes — design drives bookings','Durable materials: LVP, tile, fiberglass for high-turnover guests','Full furnishing package ($10–$14/sqft) — quality matters','Outdoor entertaining space + hot tub = biggest ADR driver in TX','Smart home: keyless entry, smart thermostats, noise monitors'],
  ltr:  ['Durable, low-maintenance finishes — functional not showroom','Spec-grade cabinets, laminate counters — not luxury','LVP throughout — no carpet — reduces turnover cost 40%','Commercial-grade fixtures to minimize emergency repair calls','HVAC replacement if needed — #1 tenant satisfaction driver in TX'],
};

export function StrategyPanel({ input, rehab, deal, recommendations }: { input: PropertyInput; rehab: RehabResult; deal: DealResult; recommendations: RehabRecommendation[] }) {
  const alloc = getBudgetAllocationTargets(input.exitStrategy);
  const tx    = deal.texasCosts;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-medium mb-3 text-gray-700">Recommended scope — {input.exitStrategy === 'flip' ? 'Fix & Flip' : input.exitStrategy === 'str' ? 'STR/Airbnb' : 'Long-Term Rental'}</h3>
          <div className="space-y-2">
            {(SCOPES[input.exitStrategy] ?? []).map((item, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-orange-500 shrink-0 mt-0.5">▸</span>
                <span className="text-gray-600">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-medium mb-3 text-gray-700">Target budget allocation</h3>
          <div className="space-y-2.5">
            {Object.entries(alloc).map(([cat, target]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-32 text-right shrink-0">{cat}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div className="h-2 rounded-full bg-orange-500" style={{ width:`${target * 2.5}%` }} />
                </div>
                <span className="text-xs font-mono w-8 shrink-0 text-gray-600">{target}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3 text-gray-700">ROI optimization recommendations</h3>
        <div className="space-y-3">
          {recommendations.length === 0 && (
            <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4">Budget looks well-optimized for your strategy. No major adjustments needed.</div>
          )}
          {recommendations.map((rec, i) => (
            <div key={i} className={`border rounded-xl p-4 ${rec.action === 'increase' ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rec.action === 'increase' ? 'bg-green-200 text-green-900' : 'bg-amber-200 text-amber-900'}`}>
                    {rec.action === 'increase' ? '↑ Boost' : '↓ Trim'} — {rec.category}
                  </span>
                  <span className={`text-xs px-1.5 rounded ${rec.priority === 'high' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}>{rec.priority}</span>
                </div>
                {rec.estimatedArvImpact !== 0 && <span className="text-xs text-gray-500 font-mono">ARV impact: {rec.estimatedArvImpact > 0 ? '+' : ''}{fmt(rec.estimatedArvImpact)}</span>}
              </div>
              <div className="text-sm text-gray-600 leading-relaxed">{rec.rationale}</div>
              <div className="flex gap-4 mt-2 text-xs text-gray-400 font-mono">
                <span>Current: {fmt(rec.currentAmount)}</span>
                <span>→ Suggested: {fmt(rec.suggestedAmount)}</span>
                <span>Delta: {rec.delta >= 0 ? '+' : ''}{fmt(rec.delta)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">Texas-specific cost schedule</div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100"><th className="text-left px-5 py-2 text-xs text-gray-400 font-medium">Cost item</th><th className="text-right px-5 py-2 text-xs text-gray-400 font-medium">Rate</th><th className="text-right px-5 py-2 text-xs text-gray-400 font-medium">Amount</th></tr></thead>
          <tbody>
            {[
              ['Realtor commissions (sell)', '5.5%',          fmt(tx.realtorCommission)],
              ['Title + escrow (buy)',        '~1.5%',         fmt(tx.titleEscrowBuy)],
              ['Title + escrow (sell)',       '~1.0%',         fmt(tx.titleEscrowSell)],
              [`Property taxes (${input.holdingMonths}mo)`, '~2.25%/yr', fmt(tx.propertyTax)],
              [`Insurance (${input.holdingMonths}mo)`,       '~$145/mo',  fmt(tx.insurance)],
              [`HML interest (${input.holdingMonths}mo)`,    `${input.hardMoneyRate}%/yr`, fmt(deal.loan.totalInterest)],
              [`Origination (${input.hardMoneyPoints} pts)`, '% of loan', fmt(deal.loan.originationFee)],
            ].map(([label, rate, amount]) => (
              <tr key={label} className="border-t border-gray-100">
                <td className="px-5 py-2.5">{label}</td>
                <td className="px-5 py-2.5 text-right text-gray-400">{rate}</td>
                <td className="px-5 py-2.5 text-right font-mono">{amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
