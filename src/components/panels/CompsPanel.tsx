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

interface LiveComp {
  address: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  pricePerSqft: number;
  daysAgo: number;
  distanceMiles?: number;
  source: string;
}

interface Props {
  input: PropertyInput;
  comps: CompsResult;
  risks: RiskFlag[];
  onUpdateArv: (arv: number) => void;
}

export function CompsPanel({ input, comps, risks, onUpdateArv }: Props) {
  const [liveComps, setLiveComps] = useState<LiveComp[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [searched, setSearched]   = useState(false);
  const [suggestedArv, setSuggestedArv] = useState<number | null>(null);
  const [arvApplied, setArvApplied]     = useState(false);

  // Auto-calculate ARV from live comps
  const calcSuggestedArv = (compList: LiveComp[]) => {
    if (!compList.length) return;
    const prices  = compList.map(c => c.price).sort((a,b) => a - b);
    const trimmed = prices.length > 4 ? prices.slice(1, -1) : prices;
    const avg     = Math.round(trimmed.reduce((a,b) => a+b,0) / trimmed.length);
    setSuggestedArv(avg);
    setArvApplied(false);
  };

 const fetchLiveComps = async () => {
    setLoading(true);
    setError('');
    setSearched(true);
    setArvApplied(false);

    try {
      const res = await fetch(
        `/api/comps?zip=${input.zipCode}&city=${encodeURIComponent(input.city||'')}&beds=${input.bedrooms}&sqft=${input.sqft}&address=${encodeURIComponent(input.address||'')}`
      );
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      if (data.comps && data.comps.length > 0) {
        setLiveComps(data.comps);

        // Use server-calculated ARV if available, otherwise calculate locally
        const arv = data.suggestedArv || calcSuggestedArvFromComps(data.comps);
        setSuggestedArv(arv);

        // Auto-apply ARV immediately
        onUpdateArv(arv);
        setArvApplied(true);
      } else {
        setError('No recent sales found for this zip. Try a nearby zip code.');
      }
    } catch (e) {
      setError('Could not load live comps. Simulated estimates shown below.');
    } finally {
      setLoading(false);
    }
  };

  const calcSuggestedArvFromComps = (compList: LiveComp[]) => {
    const prices  = compList.map(c => c.price).sort((a, b) => a - b);
    const trimmed = prices.length > 4 ? prices.slice(1, -1) : prices;
    return Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);
  };

  const applyArv = () => {
    if (suggestedArv) {
      onUpdateArv(suggestedArv);
      setArvApplied(true);
    }
  };

  const avgEstComp = Math.round(comps.saleComps.reduce((a,c) => a+c.soldPrice,0) / comps.saleComps.length);
  const arvOk = input.arv <= comps.arvRange.high * 1.08;
  const displayComps = liveComps.length > 0 ? liveComps : null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Live comps card */}
      <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:12, padding:20, boxShadow:'0 1px 3px rgba(31,58,95,0.06)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#1F3A5F' }}>Live comparable sales</div>
            <div style={{ fontSize:12, color:'#6B7C93', marginTop:2 }}>
              Free public data · Calibrated to {input.zipCode} · 0.5–2 mile radius
            </div>
          </div>
          <button
            onClick={fetchLiveComps}
            disabled={loading}
            style={{ padding:'9px 22px', background:loading?'#6B7C93':'#1F3A5F', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:loading?'not-allowed':'pointer', whiteSpace:'nowrap' }}>
            {loading ? '⏳ Searching...' : '🔍 Pull comps'}
          </button>
        </div>

        {searched && (
          <div style={{ fontSize:12, color:'#6B7C93', marginBottom:8 }}>
            📍 Searching near: <strong>{input.address ? input.address + ', ' : ''}{input.city || 'TX'} {input.zipCode}</strong>
            {input.bedrooms ? ` · ${input.bedrooms} bed` : ''}
          </div>
        )}

        {error && (
          <div style={{ background:'#fef5e7', border:'1px solid #E07B2A', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#935116', marginBottom:10 }}>
            ⚠ {error}
          </div>
        )}

        {/* ARV suggestion banner */}
        {suggestedArv && !arvApplied && (
          <div style={{ background:'#e8faf9', border:'2px solid #2EC4B6', borderRadius:10, padding:'14px 18px', marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontWeight:700, color:'#1a8a82', fontSize:14 }}>
                📊 Suggested ARV: <span style={{ fontFamily:'monospace' }}>{fmt(suggestedArv)}</span>
              </div>
              <div style={{ fontSize:12, color:'#6B7C93', marginTop:2 }}>
                Based on {liveComps.length} comparable sales within 0.5–2 miles.
                Your current ARV is <strong>{fmt(input.arv)}</strong>
                {suggestedArv > input.arv
                  ? ` — comps suggest you can go ${fmt(suggestedArv - input.arv)} higher.`
                  : ` — comps suggest reducing by ${fmt(input.arv - suggestedArv)}.`}
              </div>
            </div>
            <button
              onClick={applyArv}
              style={{ padding:'9px 20px', background:'#2EC4B6', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', marginLeft:16 }}>
              ✓ Apply {fmt(suggestedArv)}
            </button>
          </div>
        )}

        {arvApplied && (
          <div style={{ background:'#e8faf9', border:'1px solid #2EC4B6', borderRadius:8, padding:'10px 14px', marginBottom:10, fontSize:13, color:'#1a8a82', fontWeight:600 }}>
            ✓ ARV updated to {fmt(suggestedArv!)} — deal calculations refreshed automatically.
          </div>
        )}

        {/* Live comp cards */}
        {displayComps && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {displayComps.slice(0,6).map((c,i) => (
              <div key={i} style={{ background:'#F5F6F8', border:'1px solid #DDE3EC', borderRadius:10, padding:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'#2EC4B6' }}>
                    Comp {i+1}
                  </div>
                  {c.distanceMiles && (
                    <div style={{ fontSize:10, color:'#6B7C93' }}>{c.distanceMiles}mi</div>
                  )}
                </div>
                <div style={{ fontSize:19, fontWeight:700, fontFamily:'monospace', color:'#1F3A5F' }}>
                  {fmt(c.price)}
                </div>
                <div style={{ fontSize:11, color:'#6B7C93', marginTop:4, lineHeight:1.7 }}>
                  {c.address}<br/>
                  {c.beds}bd/{c.baths}ba · {c.sqft?.toLocaleString()} sqft<br/>
                  {fmt(c.pricePerSqft)}/sqft
                  <br/>
                  <span style={{ color:'#2EC4B6', fontWeight:600 }}>Sold {c.daysAgo} days ago</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!searched && (
          <div style={{ background:'#F5F6F8', borderRadius:8, padding:20, textAlign:'center', fontSize:13, color:'#6B7C93' }}>
            Click <strong>Pull comps</strong> to fetch recent sales near <strong>{input.zipCode}</strong> and auto-suggest your ARV.
          </div>
        )}

        <div style={{ marginTop:12, fontSize:11, color:'#6B7C93', borderTop:'1px solid #F0F2F5', paddingTop:8 }}>
          📡 Sources: Public records · Zillow estimates · Redfin · No subscription required
        </div>
      </div>

      {/* Estimated comps */}
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>
          Market-calibrated estimates — {input.zipCode}
        </div>
        <div style={{ fontSize:11, color:'#6B7C93', marginBottom:10 }}>
          Regional estimates based on TX market data. Pull live comps above for actual sales.
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
            <div style={{ fontSize:11, color:'#6B7C93', marginBottom:4 }}>Estimated comp average</div>
            <div style={{ fontSize:22, fontWeight:700, fontFamily:'monospace', marginBottom:4 }}>{fmt(avgEstComp)}</div>
            <div style={{ fontSize:11, color:'#6B7C93' }}>Range: {fmt(comps.arvRange.low)} – {fmt(comps.arvRange.high)}</div>
            <div style={{ fontSize:11, color:'#6B7C93' }}>
              Confidence: <span style={{ fontWeight:600, color:comps.arvConfidence==='high'?'#16a34a':comps.arvConfidence==='medium'?'#d97706':'#dc2626' }}>
                {comps.arvConfidence}
              </span>
            </div>
            <div style={{ marginTop:10, fontSize:13, padding:'8px 12px', borderRadius:6, background:arvOk?'#f0fdf4':'#fef2f2', color:arvOk?'#14532d':'#7f1d1d' }}>
              {arvOk ? `✓ Your ARV (${fmt(input.arv)}) is within comp range` : `⚠ Your ARV (${fmt(input.arv)}) exceeds comp ceiling`}
            </div>
            {suggestedArv && (
              <div style={{ marginTop:8, fontSize:12, color:'#2EC4B6', fontWeight:600 }}>
                Live comp suggestion: {fmt(suggestedArv)}
                {!arvApplied && (
                  <button onClick={applyArv}
                    style={{ marginLeft:8, fontSize:11, padding:'2px 10px', background:'#2EC4B6', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontWeight:600 }}>
                    Apply
                  </button>
                )}
              </div>
            )}
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
