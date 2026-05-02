'use client';

import type { PropertyInput, RehabResult } from '@/types';
import { getRegionalPricing } from '@/lib/engines/rehabEngine';

const fmt = (n: number) => '$' + Math.round(n).toLocaleString();
const COLORS = ['#c2620a','#185fa5','#3b6d11','#854f0b','#993556','#534ab7','#1d9e75','#d85a30','#888'];

export function RehabBreakdownPanel({ input, rehab }: { input: PropertyInput; rehab: RehabResult }) {
  const entries = Object.entries(rehab.lineItems).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total   = rehab.total;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'Total rehab cost', value:fmt(total), sub:'All line items + contingency' },
          { label:'Cost per sqft',    value:`${fmt(rehab.perSqft)}/sqft`, sub:'Dynamically calculated' },
          { label:'Region',           value:rehab.regionLabel, sub:`Labor ×${rehab.laborMultiplier.toFixed(2)} · Age ×${rehab.ageMultiplier.toFixed(2)}` },
        ].map(m => (
          <div key={m.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">{m.label}</div>
            <div className="text-xl font-semibold font-mono text-gray-900">{m.value}</div>
            <div className="text-[11px] text-gray-400 mt-1">{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <h3 className="text-sm font-medium mb-3 text-gray-700">Line-item breakdown</h3>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Category</th>
                <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Cost</th>
                <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">%</th>
              </tr></thead>
              <tbody>
                {entries.map(([key, val], i) => (
                  <tr key={key} className="border-t border-gray-100">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{fmt(val)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{((val / total) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="px-4 py-2.5 font-medium">Total</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold">{fmt(total)}</td>
                  <td className="px-4 py-2.5 text-right">100%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-2">
            {entries.slice(0, 7).map(([key, val], i) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-24 text-right shrink-0 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div className="h-2 rounded-full" style={{ width:`${(val/total)*100}%`, background:COLORS[i%COLORS.length] }} />
                </div>
                <span className="text-xs font-mono w-16 shrink-0 text-gray-600">{fmt(val)}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3 text-gray-700">Pricing engine details</h3>
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 text-sm">
            {[
              ['Region', rehab.regionLabel],
              ['Labor multiplier', `${rehab.laborMultiplier.toFixed(2)}×`],
              ['Age adjustment', `${rehab.ageMultiplier.toFixed(2)}× (built ${input.yearBuilt})`],
              ['Strategy multiplier', `${rehab.strategyMultiplier.toFixed(2)}× (${input.exitStrategy})`],
              ['Finish level', rehab.finishLevel],
              ['Pricing version', rehab.pricingVersion],
              ['Contingency rate', input.condition === 'light' || input.condition === 'moderate' ? '10%' : '15%'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium capitalize">{value}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
            <div className="font-medium">⚠ Pricing notes</div>
            <div>Estimates based on Q1-2025 TX contractor surveys. Always get 3 competitive bids before committing to a rehab budget.</div>
            <div className="font-medium mt-2">Live API integrations (V2)</div>
            <div>RSMeans · HomeAdvisor · BLS OES · Material pricing feeds</div>
          </div>
        </div>
      </div>
    </div>
  );
}
