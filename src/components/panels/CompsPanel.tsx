'use client';

import type { PropertyInput, CompsResult, RiskFlag } from '@/types';

const fmt = (n: number) => '$' + Math.round(n).toLocaleString();

function Risk({ risk }: { risk: RiskFlag }) {
  const s = { danger:'bg-red-50 border-l-4 border-red-500 text-red-900', warning:'bg-amber-50 border-l-4 border-amber-500 text-amber-900', info:'bg-blue-50 border-l-4 border-blue-500 text-blue-900' };
  const ic = { danger:'🚨', warning:'⚠', info:'ℹ' };
  return (
    <div className={`rounded-lg p-3 mb-2 ${s[risk.severity]}`}>
      <div className="flex gap-2 text-sm"><span>{ic[risk.severity]}</span>
        <div><div className="font-medium">{risk.title}</div>
          <div className="text-xs mt-0.5 opacity-80">{risk.description}</div>
          {risk.mitigation && <div className="text-xs mt-1 italic opacity-70">Fix: {risk.mitigation}</div>}
        </div>
      </div>
    </div>
  );
}

export function CompsPanel({ input, comps, risks }: { input: PropertyInput; comps: CompsResult; risks: RiskFlag[] }) {
  const arvOk = input.arv <= comps.arvRange.high * 1.08;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium mb-1 text-gray-700">Sale comparables — simulated</h3>
        <p className="text-xs text-gray-400 mb-3">Connect PropStream or ATTOM API for live MLS comps in production.</p>
        <div className="grid grid-cols-3 gap-3">
          {comps.saleComps.map((c, i) => (
            <div key={c.id} className="bg-white border border-blue-200 rounded-xl p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 mb-2">Flip comp {i + 1}</div>
              <div className="text-xl font-semibold font-mono">{fmt(c.soldPrice)}</div>
              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                <div>{c.address}</div>
                <div>{c.beds}bd/{c.baths}ba · {c.sqft.toLocaleString()} sqft</div>
                <div>{fmt(c.pricePerSqft)}/sqft · {c.daysOnMarket} DOM · {c.soldDate}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <h3 className="text-sm font-medium mb-3 text-gray-700">Rental comparables</h3>
          <div className="space-y-2">
            {comps.rentalComps.map(c => (
              <div key={c.id} className={`bg-white border rounded-xl p-4 ${c.type === 'str' ? 'border-amber-200' : 'border-green-200'}`}>
                <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${c.type === 'str' ? 'text-amber-600' : 'text-green-600'}`}>{c.type === 'str' ? 'STR' : 'LTR'}</div>
                <div className="text-xl font-semibold font-mono">{fmt(c.monthlyRent)}<span className="text-xs font-normal text-gray-400">/{c.type === 'str' ? 'night avg' : 'mo'}</span></div>
                <div className="text-xs text-gray-500 mt-1">{c.address}</div>
                {c.occupancyRate && <div className="text-xs text-gray-500">Occ: {(c.occupancyRate * 100).toFixed(0)}% · Annual: {fmt(c.annualRevenue ?? 0)}</div>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3 text-gray-700">ARV analysis</h3>
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">Suggested ARV</div>
              <div className="text-2xl font-semibold font-mono">{fmt(comps.suggestedArv)}</div>
              <div className="text-xs text-gray-400 mt-1">Range: {fmt(comps.arvRange.low)} – {fmt(comps.arvRange.high)}</div>
              <div className="text-xs text-gray-400">Confidence: <span className={`font-medium ${comps.arvConfidence === 'high' ? 'text-green-700' : comps.arvConfidence === 'medium' ? 'text-amber-700' : 'text-red-700'}`}>{comps.arvConfidence}</span></div>
            </div>
            <div className={`text-sm px-3 py-2 rounded-lg ${arvOk ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              {arvOk ? `✓ Your ARV (${fmt(input.arv)}) is within comp range` : `⚠ Your ARV (${fmt(input.arv)}) is above comp ceiling`}
            </div>
            <div><div className="text-xs text-gray-500 mb-1">Finish recommendation</div><div className="font-medium capitalize">{comps.finishRecommendation}</div></div>
          </div>
          <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs font-medium mb-2 text-gray-700">Market notes</div>
            <div className="text-xs text-gray-500 leading-relaxed">{comps.neighborhoodNotes}</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3 text-gray-700">Risk flags</h3>
        {risks.map(r => <Risk key={r.id} risk={r} />)}
      </div>

      <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <div className="font-medium text-gray-700">V2 API integration roadmap</div>
        <div>• <strong>PropStream</strong> ($99/mo) — live MLS sale comps</div>
        <div>• <strong>AirDNA</strong> — STR market data: ADR, occupancy, revenue</div>
        <div>• <strong>Rentometer</strong> — LTR rental comps by bedroom count</div>
        <div>• <strong>ATTOM Data</strong> — property records, AVM, distressed flags</div>
      </div>
    </div>
  );
}
