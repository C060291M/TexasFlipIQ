'use client';
import { useState, useEffect } from 'react';
import type { PropertyInput, CompsResult, RiskFlag } from '@/types';

const fmt = (n: number) => '$'+Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:0});
const pct = (n: number) => (n * 100).toFixed(0) + '%';

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
  yearBuilt?: number;
  pricePerSqft: number;
  daysAgo: number;
  distanceMiles: number;
  source: string;
}

interface StrData {
  adr: number;
  occupancy: number;
  annualRevenue: number;
  monthlyRevenue: number;
  source: string;
  sampleSize: number;
  premiums: { pool: boolean; waterfront: boolean };
}

interface Props {
  input: PropertyInput;
  comps: CompsResult;
  risks: RiskFlag[];
  onUpdateArv: (arv: number) => void;
}

export function CompsPanel({ input, comps, risks, onUpdateArv }: Props) {
  const [liveComps, setLiveComps]   = useState<LiveComp[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [searched, setSearched]     = useState(false);
  const [suggestedArv, setSuggestedArv] = useState<number|null>(null);
  const [arvApplied, setArvApplied]     = useState(false);
  const [strData, setStrData]       = useState<StrData|null>(null);
  const [strLoading, setStrLoading] = useState(false);

  const isStr = input.exitStrategy === 'str';

  // Auto-fetch STR data when on STR strategy
  useEffect(() => {
    if (isStr && input.zipCode && !strData) {
      fetchStrData();
    }
  }, [input.exitStrategy, input.zipCode, input.hasPool, input.isWaterfront]);

  const fetchStrData = async () => {
    setStrLoading(true);
    try {
      const res = await fetch(
        `/api/str?zip=${input.zipCode}&city=${encodeURIComponent(input.city||'')}&beds=${input.bedrooms}&pool=${input.hasPool||false}&waterfront=${input.isWaterfront||false}`
      );
      if (res.ok) {
        const data = await res.json();
        setStrData(data);
      }
    } catch (e) {
      console.error('STR fetch error:', e);
    } finally {
      setStrLoading(false);
    }
  };

  const fetchLiveComps = async () => {
    setLoading(true);
    setError('');
    setSearched(true);
    setArvApplied(false);

    try {
      const res = await fetch(
        `/api/comps?zip=${input.zipCode}&city=${encodeURIComponent(input.city||'')}&beds=${input.bedrooms}&sqft=${input.sqft}&year=${input.yearBuilt}&pool=${input.hasPool||false}&waterfront=${input.isWaterfront||false}&address=${encodeURIComponent(input.address||'')}`
      );
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      if (data.comps && data.comps.length > 0) {
        setLiveComps(data.comps);
        const arv = data.suggestedArv || calcArvFromComps(data.comps);
        setSuggestedArv(arv);
        onUpdateArv(arv);
        setArvApplied(true);
      } else {
        setError('No recent sales found. Try a nearby zip code.');
      }
    } catch (e) {
      setError('Could not load live comps. Estimates shown below.');
    } finally {
      setLoading(false);
    }
  };

  const calcArvFromComps = (compList: LiveComp[]) => {
    const prices  = compList.map(c => c.price).sort((a,b) => a-b);
    const trimmed = prices.length > 4 ? prices.slice(1,-1) : prices;
    return Math.round(trimmed.reduce((a,b) => a+b,0) / trimmed.length);
  };

  const avgEstComp = Math.round(comps.saleComps.reduce((a,c) => a+c.soldPrice,0) / comps.saleComps.length);
  const arvOk = input.arv > 0 && input.arv <= comps.arvRange.high * 1.10;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* STR section — show when STR strategy selected */}
      {isStr && (
        <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:12, padding:20, boxShadow:'0 1px 3px rgba(31,58,95,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#1F3A5F' }}>✈ STR market data — {input.city || input.zipCode}</div>
              <div style={{ fontSize:12, color:'#6B7C93', marginTop:2 }}>
                Real-time Airbnb rates ·
                {input.hasPool      ? ' 🏊 Pool premium (+18%)' : ''}
                {input.isWaterfront ? ' 🌊 Waterfront premium (+25%)' : ''}
                {!input.hasPool && !input.isWaterfront ? ' Standard market rates' : ''}
              </div>
            </div>
            <button onClick={fetchStrData} disabled={strLoading}
              style={{ padding:'8px 18px', background:strLoading?'#6B7C93':'#1F3A5F', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:strLoading?'not-allowed':'pointer' }}>
              {strLoading ? '⏳ Loading...' : '🔄 Refresh rates'}
            </button>
          </div>

          {strData ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {[
                ['Avg daily rate',    `$${strData.adr}/night`,                    '#2EC4B6'],
                ['Occupancy rate',    pct(strData.occupancy),                     '#1F3A5F'],
                ['Monthly revenue',   fmt(strData.monthlyRevenue),                '#1a8a82'],
                ['Annual revenue',    fmt(strData.annualRevenue),                 '#E07B2A'],
              ].map(([label, value, color]) => (
                <div key={label} style={{ background:'#F5F6F8', borderRadius:10, padding:'14px 16px' }}>
                  <div style={{ fontSize:10, color:'#6B7C93', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:20, fontWeight:700, fontFamily:'monospace', color:color as string }}>{value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background:'#F5F6F8', borderRadius:8, padding:16, textAlign:'center', fontSize:13, color:'#6B7C93' }}>
              {strLoading ? '⏳ Fetching real-time Airbnb rates...' : 'Click Refresh rates to load STR data'}
            </div>
          )}

          {strData && (
            <div style={{ marginTop:10, fontSize:11, color:'#6B7C93', borderTop:'1px solid #F0F2F5', paddingTop:8, display:'flex', justifyContent:'space-between' }}>
              <span>Source: {strData.source === 'airbnb_live' ? '✅ Live Airbnb data' : '📊 Market estimates'} · {input.bedrooms} bed · {strData.sampleSize > 0 ? `${strData.sampleSize} listings analyzed` : 'Regional data'}</span>
              {strData.premiums.pool      && <span>🏊 Pool: +18% ADR</span>}
              {strData.premiums.waterfront && <span>🌊 Waterfront: +25% ADR</span>}
            </div>
          )}
        </div>
      )}

      {/* Live comps */}
      <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:12, padding:20, boxShadow:'0 1px 3px rgba(31,58,95,0.06)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#1F3A5F' }}>Live comparable sales</div>
            <div style={{ fontSize:12, color:'#6B7C93', marginTop:2 }}>
              Filtered: {input.sqft > 0 ? `${Math.round(input.sqft*0.80).toLocaleString()}–${Math.round(input.sqft*1.20).toLocaleString()} sqft` : 'any sqft'}
              {input.yearBuilt > 0 ? ` · Built ${input.yearBuilt-15}–${input.yearBuilt+15}` : ''}
              {input.hasPool ? ' · Has pool' : ''}
              {input.isWaterfront ? ' · Waterfront' : ''}
            </div>
          </div>
          <button onClick={fetchLiveComps} disabled={loading}
            style={{ padding:'9px 22px', background:loading?'#6B7C93':'#1F3A5F', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:loading?'not-allowed':'pointer', whiteSpace:'nowrap' }}>
            {loading ? '⏳ Searching...' : '🔍 Pull comps'}
          </button>
        </div>

        {searched && (
          <div style={{ fontSize:12, color:'#6B7C93', marginBottom:8 }}>
            📍 Near: <strong>{input.address ? input.address+', ' : ''}{input.city||'TX'} {input.zipCode}</strong>
            {input.bedrooms ? ` · ${input.bedrooms} bed` : ''}
            {input.sqft > 0 ? ` · ${input.sqft.toLocaleString()} sqft` : ''}
          </div>
        )}

        {error && (
          <div style={{ background:'#fef5e7', border:'1px solid #E07B2A', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#935116', marginBottom:10 }}>
            ⚠ {error}
          </div>
        )}

        {arvApplied && suggestedArv && (
          <div style={{ background:'#e8faf9', border:'2px solid #2EC4B6', borderRadius:8, padding:'10px 14px', marginBottom:10, fontSize:13, color:'#1a8a82', fontWeight:600 }}>
            ✓ ARV auto-set to {fmt(suggestedArv)} based on {liveComps.length} comparable sales
          </div>
        )}

        {liveComps.length > 0 ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {liveComps.map((c,i) => (
              <div key={i} style={{ background:'#F5F6F8', border:'1px solid #DDE3EC', borderRadius:10, padding:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'#2EC4B6' }}>Comp {i+1}</div>
                  <div style={{ fontSize:10, color:'#6B7C93' }}>{c.distanceMiles}mi</div>
                </div>
                <div style={{ fontSize:19, fontWeight:700, fontFamily:'monospace', color:'#1F3A5F' }}>{fmt(c.price)}</div>
                <div style={{ fontSize:11, color:'#6B7C93', marginTop:4, lineHeight:1.7 }}>
                  {c.address}<br/>
                  {c.beds}bd/{c.baths}ba · {c.sqft?.toLocaleString()} sqft<br/>
                  {c.yearBuilt ? `Built ${c.yearBuilt} · ` : ''}{fmt(c.pricePerSqft)}/sqft<br/>
                  <span style={{ color:'#2EC4B6', fontWeight:600 }}>Sold {c.daysAgo} days ago</span>
                </div>
              </div>
            ))}
          </div>
        ) : !searched ? (
          <div style={{ background:'#F5F6F8', borderRadius:8, padding:20, textAlign:'center', fontSize:13, color:'#6B7C93' }}>
            Enter property details then click <strong>Pull comps</strong> to fetch comparable sales and auto-set ARV.
          </div>
        ) : null}

        <div style={{ marginTop:12, fontSize:11, color:'#6B7C93', borderTop:'1px solid #F0F2F5', paddingTop:8 }}>
          📡 Sources: Zillow public records · Redfin · Public property data · No subscription required
        </div>
      </div>

      {/* Estimated comps */}
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>
          Market-calibrated estimates — {input.zipCode}
        </div>
        <div style={{ fontSize:11, color:'#6B7C93', marginBottom:10 }}>
          Based on regional TX market data. Pull live comps above for actual sold prices.
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {comps.saleComps.slice(0,3).map((c,i) => (
            <div key={c.id} style={{ background:'#FFFFFF', border:'1px solid #bfdbfe', borderRadius:10, padding:14 }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'#1d4ed8', marginBottom:6 }}>Est. comp {i+1}</div>
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

      {/* ARV + rental analysis */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>
            {isStr ? 'STR revenue detail' : 'Rental estimates'}
          </div>
          {isStr && strData ? (
            <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:10, padding:16 }}>
              <div style={{ fontSize:11, color:'#6B7C93', marginBottom:8 }}>
                {input.city || input.zipCode} · {input.bedrooms} bed · {strData.source === 'airbnb_live' ? 'Live Airbnb data' : 'Market estimate'}
              </div>
              {[
                ['Avg daily rate',   `$${strData.adr}/night`],
                ['Occupancy',        pct(strData.occupancy)],
                ['Monthly revenue',  fmt(strData.monthlyRevenue)],
                ['Annual revenue',   fmt(strData.annualRevenue)],
                ['Operating exp (40%)', fmt(Math.round(strData.annualRevenue * 0.40))],
                ['Net operating income', fmt(Math.round(strData.annualRevenue * 0.60))],
              ].map(([l,v]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #F0F2F5', fontSize:13 }}>
                  <span style={{ color:'#6B7C93' }}>{l}</span>
                  <span style={{ fontWeight:600, color:'#1F3A5F' }}>{v}</span>
                </div>
              ))}
            </div>
          ) : (
            comps.rentalComps.map(c => (
              <div key={c.id} style={{ background:'#FFFFFF', border:`1px solid ${c.type==='str'?'#fcd34d':'#86efac'}`, borderRadius:10, padding:12, marginBottom:8 }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:c.type==='str'?'#d97706':'#16a34a', marginBottom:4 }}>{c.type.toUpperCase()}</div>
                <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace' }}>
                  {c.type === 'str' && c.avgDailyRate ? `$${c.avgDailyRate}/night` : fmt(c.monthlyRent)+'/mo'}
                </div>
                {c.type === 'str' && c.monthlyRent > 0 && (
                  <div style={{ fontSize:11, color:'#6B7C93', marginTop:2 }}>~{fmt(c.monthlyRent)}/mo revenue</div>
                )}
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{c.address}</div>
                {c.occupancyRate && <div style={{ fontSize:11, color:'#9ca3af' }}>Occupancy: {(c.occupancyRate*100).toFixed(0)}% · Annual: {fmt(c.annualRevenue??0)}</div>}
              </div>
            ))
          )}
        </div>

        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>ARV analysis</div>
          <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:10, padding:16, marginBottom:10 }}>
            <div style={{ fontSize:11, color:'#6B7C93', marginBottom:4 }}>Estimated comp average</div>
            <div style={{ fontSize:22, fontWeight:700, fontFamily:'monospace', marginBottom:4 }}>{fmt(avgEstComp)}</div>
            <div style={{ fontSize:11, color:'#6B7C93' }}>Range: {fmt(comps.arvRange.low)} – {fmt(comps.arvRange.high)}</div>
            <div style={{ fontSize:11, color:'#6B7C93' }}>
              Confidence: <span style={{ fontWeight:600, color:comps.arvConfidence==='high'?'#16a34a':comps.arvConfidence==='medium'?'#d97706':'#dc2626' }}>
                {comps.arvConfidence}
              </span>
            </div>
            {input.arv > 0 && (
              <div style={{ marginTop:10, fontSize:13, padding:'8px 12px', borderRadius:6, background:arvOk?'#f0fdf4':'#fef2f2', color:arvOk?'#14532d':'#7f1d1d' }}>
                {arvOk ? `✓ Your ARV (${fmt(input.arv)}) is within comp range` : `⚠ Your ARV (${fmt(input.arv)}) may be outside comp range`}
              </div>
            )}
            {suggestedArv && (
              <div style={{ marginTop:8, fontSize:12, color:'#2EC4B6', fontWeight:600 }}>
                Live comp ARV: {fmt(suggestedArv)} ✓ Applied
              </div>
            )}
            {input.isWaterfront && (
              <div style={{ marginTop:8, fontSize:11, color:'#2980b9', background:'#e8f4f8', padding:'6px 10px', borderRadius:6 }}>
                🌊 Waterfront premium included in estimates
              </div>
            )}
            {input.hasPool && (
              <div style={{ marginTop:6, fontSize:11, color:'#1a8a82', background:'#e8faf9', padding:'6px 10px', borderRadius:6 }}>
                🏊 Pool premium included in estimates
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
        <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>Risk flags</div>
        {risks.map(r => <RiskBadge key={r.id} r={r} />)}
      </div>
    </div>
  );
}
