'use client';
import { useState } from 'react';
import type { PropertyInput, CompsResult, RiskFlag } from '@/types';

const fmt = (n: number) => '$'+Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:0});

function RiskBadge({ r }: { r: RiskFlag }) {
  const styles = {
    danger:  { bg:'#fdecea', border:'#C0392B', color:'#922b21', icon:'🚨' },
    warning: { bg:'#fef5e7', border:'#E07B2A', color:'#935116', icon:'⚠' },
    info:    { bg:'#e8f4f8', border:'#2980b9', color:'#1a6080', icon:'ℹ' },
  };
  const st = styles[r.severity];
  return (
    <div style={{ background:st.bg, borderLeft:`3px solid ${st.border}`, borderRadius:6, padding:'10px 14px', marginBottom:8, fontSize:12, lineHeight:1.6 }}>
      <div style={{ fontWeight:700, color:st.color }}>{st.icon} {r.title}</div>
      <div style={{ marginTop:2, color:'#1F3A5F' }}>{r.description}</div>
      {r.mitigation && <div style={{ marginTop:4, color:'#6B7C93', fontStyle:'italic' }}>Fix: {r.mitigation}</div>}
    </div>
  );
}

interface ZillowComp {
  address: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  pricePerSqft: number;
  daysAgo: number;
  source: string;
}

export function CompsPanel({ input, comps, risks }: {
  input: PropertyInput;
  comps: CompsResult;
  risks: RiskFlag[];
}) {
  const [liveComps, setLiveComps]   = useState<ZillowComp[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [searched, setSearched]     = useState(false);

  const avgComp = Math.round(
    comps.saleComps.reduce((a, c) => a + c.soldPrice, 0) / comps.saleComps.length
  );
  const arvOk = input.arv <= comps.arvRange.high * 1.08;

  // ── Free Zillow comp fetcher ──────────────────────────────
  // Uses Zillow's public search — no API key required
  const fetchZillowComps = async () => {
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const cityState = input.city ? `${input.city}-TX` : `TX`;
      const searchTerm = encodeURIComponent(`${cityState}-${input.zipCode}`);

      // Fetch via our own API route to avoid CORS
      const res = await fetch(`/api/comps?zip=${input.zipCode}&city=${encodeURIComponent(input.city || '')}&beds=${input.bedrooms}`);

      if (!res.ok) throw new Error('Could not fetch comps');

      const data = await res.json();
      if (data.comps && data.comps.length > 0) {
        setLiveComps(data.comps);
      } else {
        setError('No recent sales found for this zip code. Try a nearby zip.');
      }
    } catch (e) {
      setError('Could not load live comps right now. Using simulated data below.');
    } finally {
      setLoading(false);
    }
  };

  const displayComps = liveComps.length > 0 ? liveComps : null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Live comps section */}
      <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:12, padding:20, boxShadow:'0 1px 3px rgba(31,58,95,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#1F3A5F' }}>Live comparable sales</div>
            <div style={{ fontSize:12, color:'#6B7C93', marginTop:2 }}>
              Free public data — no subscription required
            </div>
          </div>
          <button
            onClick={fetchZillowComps}
            disabled={loading}
            style={{ padding:'8px 20px', background: loading ? '#6B7C93' : '#1F3A5F', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? '⏳ Searching...' : '🔍 Pull live comps'}
          </button>
        </div>

        {/* Address being searched */}
        {searched && (
          <div style={{ fontSize:12, color:'#6B7C93', marginBottom:10 }}>
            Searching: <strong>{input.zipCode}{input.city ? ` — ${input.city}, TX` : ''}</strong>
            {input.bedrooms && ` · ${input.bedrooms} bed`}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background:'#fef5e7', border:'1px solid #E07B2A', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#935116', marginBottom:10 }}>
            ⚠ {error}
          </div>
        )}

        {/* Live results */}
        {displayComps && displayComps.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginTop:8 }}>
            {displayComps.map((c, i) => (
              <div key={i} style={{ background:'#F5F6F8', border:'1px solid #DDE3EC', borderRadius:10, padding:14 }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'#2EC4B6', marginBottom:6 }}>
                  Live comp {i+1}
                </div>
                <div style={{ fontSize:19, fontWeight:700, fontFamily:'monospace', color:'#1F3A5F' }}>
                  {fmt(c.price)}
                </div>
                <div style={{ fontSize:11, color:'#6B7C93', marginTop:4, lineHeight:1.7 }}>
                  {c.address}<br/>
                  {c.beds}bd / {c.baths}ba · {c.sqft?.toLocaleString()} sqft<br/>
                  {fmt(c.pricePerSqft)}/sqft<br/>
                  <span style={{ color:'#2EC4B6', fontWeight:600 }}>Sold {c.daysAgo} days ago</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Not searched yet */}
        {!searched && (
          <div style={{ background:'#F5F6F8', borderRadius:8, padding:'16px', textAlign:'center', fontSize:13, color:'#6B7C93' }}>
            Click "Pull live comps" to fetch recent sales data for zip <strong>{input.zipCode}</strong>
          </div>
        )}

        {/* Free sources note */}
        <div style={{ marginTop:12, fontSize:11, color:'#6B7C93', borderTop:'1px solid #F0F2F5', paddingTop:10 }}>
          📡 Data sources: Zillow public records · Redfin · Realtor.com · All free, no subscription required
        </div>
      </div>

      {/* Simulated comps as backup */}
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>
          Estimated comps — {input.zipCode}
        </div>
        <div style={{ fontSize:11, color:'#6B7C93', marginBottom:10 }}>
          Market-calibrated estimates based on regional data. Pull live comps above for real sales.
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {comps.saleComps.slice(0,3).map((c,i) => (
            <div key={c.id} style={{ background:'#FFFFFF', border:'1px solid #bfdbfe', borderRadius:10, padding:14 }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'#1d4ed8', marginBottom:6 }}>
                Est. comp {i+1}
              </div>
              <div style={{ fontSize:19, fontWeight:700, fontFamily:'monospace' }}>{fmt(c.soldPrice)}</div>
              <div style={{ fontSize:11, color:'#6B7C93', marginTop:4, lineHeight:1.7 }}>
                {c.address}<br/>
                {c.beds}bd/{c.baths}ba · {c.sqft.toLocaleString()} sqft<br/>
                {fmt(c.pricePerSqft)}/sqft · {c.daysOnMarket} DOM
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rental + ARV */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>
            Rental estimates
          </div>
          {comps.rentalComps.map(c => (
            <div key={c.id} style={{ background:'#FFFFFF', border:`1px solid ${c.type==='str'?'#fcd34d':'#86efac'}`, borderRadius:10, padding:12, marginBottom:8 }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:c.type==='str'?'#d97706':'#16a34a', marginBottom:4 }}>
                {c.type.toUpperCase()}
              </div>
              <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace' }}>
                {fmt(c.monthlyRent)}
                <span style={{ fontSize:11, fontWeight:400, color:'#9ca3af' }}>/{c.type==='str'?'night avg':'mo'}</span>
              </div>
              <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{c.address}</div>
              {c.occupancyRate && (
                <div style={{ fontSize:11, color:'#9ca3af' }}>
                  Occupancy: {(c.occupancyRate*100).toFixed(0)}% · Annual: {fmt(c.annualRevenue??0)}
                </div>
              )}
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>
            ARV analysis
          </div>
          <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:10, padding:16, marginBottom:10 }}>
            <div style={{ fontSize:11, color:'#6B7C93', marginBottom:4 }}>Comp average</div>
            <div style={{ fontSize:22, fontWeight:700, fontFamily:'monospace', marginBottom:4 }}>{fmt(avgComp)}</div>
            <div style={{ fontSize:11, color:'#6B7C93' }}>
              Range: {fmt(comps.arvRange.low)} – {fmt(comps.arvRange.high)}
            </div>
            <div style={{ fontSize:11, color:'#6B7C93' }}>
              Confidence: <span style={{ fontWeight:600, color:comps.arvConfidence==='high'?'#16a34a':comps.arvConfidence==='medium'?'#d97706':'#dc2626' }}>
                {comps.arvConfidence}
              </span>
            </div>
            <div style={{ marginTop:10, fontSize:13, padding:'8px 12px', borderRadius:6, background:arvOk?'#f0fdf4':'#fef2f2', color:arvOk?'#14532d':'#7f1d1d' }}>
              {arvOk
                ? `✓ Your ARV (${fmt(input.arv)}) is within comp range`
                : `⚠ Your ARV (${fmt(input.arv)}) exceeds comp ceiling`}
            </div>
            <div style={{ marginTop:10, fontSize:12 }}>
              <span style={{ color:'#6B7C93' }}>Recommended finish: </span>
              <span style={{ fontWeight:600, textTransform:'capitalize' }}>{comps.finishRecommendation}</span>
            </div>
          </div>
          <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:10, padding:14, fontSize:12, color:'#6B7C93', lineHeight:1.6 }}>
            <div style={{ fontWeight:600, color:'#1F3A5F', marginBottom:4 }}>Market notes</div>
            {comps.neighborhoodNotes}
          </div>
        </div>
      </div>

      {/* Risks */}
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>
          Risk flags
        </div>
        {risks.map(r => <RiskBadge key={r.id} r={r} />)}
      </div>
    </div>
  );
}
