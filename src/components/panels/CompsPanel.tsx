'use client';
import { useState, useEffect } from 'react';
import type { PropertyInput, CompsResult, RiskFlag } from '@/types';
import { estimateMarketPrice } from '@/lib/engines/comparablesEngine';

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
  const [liveComps, setLiveComps]       = useState<LiveComp[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [searched, setSearched]         = useState(false);
  const [suggestedArv, setSuggestedArv] = useState<number|null>(null);
  const [arvApplied, setArvApplied]     = useState(false);
  const [strData, setStrData]           = useState<StrData|null>(null);
  const [strLoading, setStrLoading]     = useState(false);

  const isStr = input.exitStrategy === 'str';

  // Calculate ARV range from market data
  const marketBase = input.sqft > 0 && input.bedrooms > 0
    ? estimateMarketPrice(input.zipCode, input.sqft, input.bedrooms, input.isWaterfront, input.hasPool)
    : 0;

  const arvLow  = Math.round(marketBase * 0.92);
  const arvMid  = marketBase;
  const arvHigh = Math.round(marketBase * 1.10);

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
      if (res.ok) setStrData(await res.json());
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
        // Use server ARV or calculate from comps
        const arv = data.suggestedArv || calcArvFromComps(data.comps);
        setSuggestedArv(arv);
        onUpdateArv(arv);
        setArvApplied(true);
      } else {
        // Fall back to market estimate mid-point
        if (marketBase > 0) {
          setSuggestedArv(arvMid);
          onUpdateArv(arvMid);
          setArvApplied(true);
        }
        setError('No sold comps found. ARV set to market estimate — verify with a local agent.');
      }
    } catch (e) {
      if (marketBase > 0) {
        setSuggestedArv(arvMid);
        onUpdateArv(arvMid);
        setArvApplied(true);
      }
      setError('Could not load live comps. ARV set to market estimate.');
    } finally {
      setLoading(false);
    }
  };

  const calcArvFromComps = (compList: LiveComp[]) => {
    const prices  = compList.map(c => c.price).sort((a,b) => a-b);
    const trimmed = prices.length > 4 ? prices.slice(1,-1) : prices;
    return Math.round(trimmed.reduce((a,b) => a+b,0) / trimmed.length);
  };

  const arvOk = input.arv > 0 && input.arv <= comps.arvRange.high * 1.10;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── DISCLAIMER BANNER ── */}
      <div style={{ background:'#fef5e7', border:'1px solid #E07B2A', borderRadius:10, padding:'12px 16px', display:'flex', gap:10, alignItems:'flex-start' }}>
        <span style={{ fontSize:16, flexShrink:0 }}>⚠</span>
        <div style={{ fontSize:12, color:'#78350f', lineHeight:1.7 }}>
          <strong>Comps are estimates — due diligence required before locking in ARV.</strong>
          {' '}All comparable data is sourced from public records and market averages.
          Verify ARV with a licensed Texas realtor, PropStream, or MLS access before making any offer.
          This tool is a deal screener, not an appraisal.
        </div>
      </div>

      {/* ── STR SECTION ── */}
      {isStr && (
        <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:12, padding:20, boxShadow:'0 1px 3px rgba(31,58,95,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#1F3A5F' }}>
                STR market data — {input.city || input.zipCode}
              </div>
              <div style={{ fontSize:12, color:'#6B7C93', marginTop:2 }}>
                {input.hasPool ? '🏊 Pool +18% ADR · ' : ''}
                {input.isWaterfront ? '🌊 Waterfront +25% ADR · ' : ''}
                {input.bedrooms} bed · Market estimates
              </div>
            </div>
            <button onClick={fetchStrData} disabled={strLoading}
              style={{ padding:'8px 18px', background:strLoading?'#6B7C93':'#1F3A5F', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:strLoading?'not-allowed':'pointer' }}>
              {strLoading ? '⏳ Loading...' : '🔄 Refresh STR rates'}
            </button>
          </div>

          {strData ? (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:10 }}>
                {[
                  ['Avg daily rate',   `$${strData.adr}/night`,       '#2EC4B6'],
                  ['Occupancy',        pct(strData.occupancy),         '#1F3A5F'],
                  ['Monthly revenue',  fmt(strData.monthlyRevenue),    '#1a8a82'],
                  ['Annual revenue',   fmt(strData.annualRevenue),     '#E07B2A'],
                ].map(([l,v,c]) => (
                  <div key={l} style={{ background:'#F5F6F8', borderRadius:10, padding:'12px 14px' }}>
                    <div style={{ fontSize:10, color:'#6B7C93', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>{l}</div>
                    <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace', color:c as string }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:11, color:'#6B7C93', borderTop:'1px solid #F0F2F5', paddingTop:8 }}>
                Source: {strData.source === 'airbnb_live' ? '✅ Live Airbnb data' : '📊 Market estimates based on TX STR averages'}
                {' · '}Estimates only — verify with AirDNA or local STR manager before investing.
              </div>
            </>
          ) : (
            <div style={{ background:'#F5F6F8', borderRadius:8, padding:16, textAlign:'center', fontSize:13, color:'#6B7C93' }}>
              {strLoading ? '⏳ Fetching STR rates...' : 'Click Refresh STR rates to load data'}
            </div>
          )}
        </div>
      )}

      {/* ── ARV RANGE CARD ── */}
      {marketBase > 0 && (
        <div style={{ background:'#FFFFFF', border:'2px solid #2EC4B6', borderRadius:12, padding:20, boxShadow:'0 1px 3px rgba(31,58,95,0.06)' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#1F3A5F', marginBottom:12 }}>
            Estimated ARV range — {input.zipCode}
            {input.isWaterfront ? ' (Waterfront)' : ''}
            {input.hasPool ? ' (Pool)' : ''}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14 }}>
            {[
              ['Conservative (floor)', fmt(arvLow),  '#E07B2A', '92% of market median'],
              ['Market median',        fmt(arvMid),  '#2EC4B6', 'Regional baseline'],
              ['Optimistic (ceiling)', fmt(arvHigh), '#1a8a82', '110% of median'],
            ].map(([l,v,c,sub]) => (
              <div key={l} style={{ background:'#F5F6F8', borderRadius:10, padding:'14px 16px', textAlign:'center' }}>
                <div style={{ fontSize:10, color:'#6B7C93', fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>{l}</div>
                <div style={{ fontSize:20, fontWeight:700, fontFamily:'monospace', color:c as string }}>{v}</div>
                <div style={{ fontSize:10, color:'#9ca3af', marginTop:4 }}>{sub}</div>
                <button
                  onClick={() => { onUpdateArv(parseInt(v.replace(/[^0-9]/g,''))); setArvApplied(true); setSuggestedArv(parseInt(v.replace(/[^0-9]/g,''))); }}
                  style={{ marginTop:8, fontSize:10, padding:'3px 10px', background:c as string, color:'#fff', border:'none', borderRadius:4, cursor:'pointer', fontWeight:600 }}>
                  Use this
                </button>
              </div>
            ))}
          </div>

          <div style={{ fontSize:11, color:'#6B7C93', background:'#F5F6F8', borderRadius:6, padding:'8px 12px' }}>
            📊 Based on {input.sqft.toLocaleString()} sqft · {input.bedrooms}bd · {input.zipCode} market data ·
            {' '}<strong>Pull comps below</strong> for sold comparable sales to refine this range.
          </div>
        </div>
      )}

      {/* ── LIVE COMPS ── */}
      <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:12, padding:20, boxShadow:'0 1px 3px rgba(31,58,95,0.06)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#1F3A5F' }}>Comparable sold properties</div>
            <div style={{ fontSize:12, color:'#6B7C93', marginTop:2 }}>
              {input.sqft > 0 ? `${Math.round(input.sqft*0.85).toLocaleString()}–${Math.round(input.sqft*1.15).toLocaleString()} sqft` : ''}
              {input.yearBuilt > 0 ? ` · Built ${input.yearBuilt-15}–${input.yearBuilt+15}` : ''}
              {input.hasPool ? ' · Pool' : ''}
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
          </div>
        )}

        {error && (
          <div style={{ background:'#fef5e7', border:'1px solid #E07B2A', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#935116', marginBottom:10 }}>
            ⚠ {error}
          </div>
        )}

        {arvApplied && suggestedArv && (
          <div style={{ background:'#e8faf9', border:'2px solid #2EC4B6', borderRadius:8, padding:'10px 14px', marginBottom:10, fontSize:13, color:'#1a8a82', fontWeight:600 }}>
            ✓ ARV set to {fmt(suggestedArv)} — all deal calculations updated automatically
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
            Click <strong>Pull comps</strong> to search for recently sold properties near this address.
          </div>
        ) : null}

        <div style={{ marginTop:12, fontSize:11, color:'#6B7C93', borderTop:'1px solid #F0F2F5', paddingTop:8 }}>
          📡 Sources: Public records · Zillow · ATTOM Data · All free — no subscription required
        </div>
      </div>

      {/* ── MARKET ESTIMATES ── */}
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>
          Market-calibrated estimates — {input.zipCode}
        </div>
        <div style={{ fontSize:11, color:'#6B7C93', marginBottom:10 }}>
          Regional estimates based on TX median sold data. Pull live comps above for actual sales.
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {comps.saleComps.slice(0,3).map((c,i) => (
            <div key={c.id} style={{ background:'#FFFFFF', border:'1px solid #bfdbfe', borderRadius:10, padding:14 }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'#1d4ed8', marginBottom:6 }}>Est. comp {i+1}</div>
              <div style={{ fontSize:19, fontWeight:700, fontFamily:'monospace' }}>{fmt(c.soldPrice)}</div>
              <div style={{ fontSize:11, color:'#6B7C93', marginTop:4, lineHeight:1.7 }}>
                {c.beds}bd/{c.baths}ba · {c.sqft.toLocaleString()} sqft<br/>
                Built {(c as any).yearBuilt || input.yearBuilt} · {fmt(c.pricePerSqft)}/sqft<br/>
                {c.daysOnMarket} days on market
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RENTAL + ARV ANALYSIS ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>
            {isStr ? 'STR revenue breakdown' : 'Rental estimates'}
          </div>

          {isStr && strData ? (
            <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:10, padding:16 }}>
              {[
                ['Avg daily rate',           `$${strData.adr}/night`],
                ['Occupancy rate',           pct(strData.occupancy)],
                ['Monthly revenue',          fmt(strData.monthlyRevenue)],
                ['Annual gross revenue',     fmt(strData.annualRevenue)],
                ['Operating expenses (40%)', fmt(Math.round(strData.annualRevenue * 0.40))],
                ['Net operating income',     fmt(Math.round(strData.annualRevenue * 0.60))],
              ].map(([l,v]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #F0F2F5', fontSize:13 }}>
                  <span style={{ color:'#6B7C93' }}>{l}</span>
                  <span style={{ fontWeight:600, color:'#1F3A5F' }}>{v}</span>
                </div>
              ))}
              <div style={{ fontSize:10, color:'#9ca3af', marginTop:8 }}>
                Estimates only. Verify with AirDNA or local STR manager.
              </div>
            </div>
          ) : (
            comps.rentalComps.map(c => (
              <div key={c.id} style={{ background:'#FFFFFF', border:`1px solid ${c.type==='str'?'#fcd34d':'#86efac'}`, borderRadius:10, padding:12, marginBottom:8 }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:c.type==='str'?'#d97706':'#16a34a', marginBottom:4 }}>{c.type.toUpperCase()}</div>
                <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace' }}>
                  {c.type==='str' && c.avgDailyRate ? `$${c.avgDailyRate}/night` : fmt(c.monthlyRent)+'/mo'}
                </div>
                {c.type==='str' && c.monthlyRent > 0 && (
                  <div style={{ fontSize:11, color:'#6B7C93', marginTop:2 }}>~{fmt(c.monthlyRent)}/mo revenue</div>
                )}
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{c.address}</div>
                {c.occupancyRate && (
                  <div style={{ fontSize:11, color:'#9ca3af' }}>
                    Occ: {(c.occupancyRate*100).toFixed(0)}% · Annual: {fmt(c.annualRevenue??0)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>ARV analysis</div>
          <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:10, padding:16, marginBottom:10 }}>
            {input.arv > 0 ? (
              <>
                <div style={{ fontSize:11, color:'#6B7C93', marginBottom:4 }}>Your ARV</div>
                <div style={{ fontSize:22, fontWeight:700, fontFamily:'monospace', marginBottom:8, color:'#2EC4B6' }}>{fmt(input.arv)}</div>
              </>
            ) : (
              <div style={{ fontSize:13, color:'#6B7C93', marginBottom:8 }}>Pull comps to auto-set ARV</div>
            )}

            {marketBase > 0 && (
              <>
                <div style={{ fontSize:11, color:'#6B7C93', marginBottom:6 }}>Market estimate range</div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                  <span style={{ color:'#E07B2A', fontWeight:600 }}>Low: {fmt(arvLow)}</span>
                  <span style={{ color:'#2EC4B6', fontWeight:600 }}>Mid: {fmt(arvMid)}</span>
                  <span style={{ color:'#1a8a82', fontWeight:600 }}>High: {fmt(arvHigh)}</span>
                </div>
                <div style={{ background:'#F5F6F8', borderRadius:4, height:6, position:'relative', marginBottom:8 }}>
                  <div style={{ position:'absolute', left:0, right:0, top:0, bottom:0, background:'linear-gradient(to right, #E07B2A, #2EC4B6, #1a8a82)', borderRadius:4, opacity:0.4 }} />
                  {input.arv > 0 && (
                    <div style={{
                      position:'absolute', top:-3, width:12, height:12,
                      background:'#1F3A5F', borderRadius:'50%',
                      left:`${Math.min(95, Math.max(5, ((input.arv - arvLow) / (arvHigh - arvLow)) * 100))}%`,
                      transform:'translateX(-50%)',
                      boxShadow:'0 1px 3px rgba(0,0,0,0.3)',
                    }} />
                  )}
                </div>
              </>
            )}

            <div style={{ fontSize:11, color:'#6B7C93' }}>
              Confidence: <span style={{ fontWeight:600, color:comps.arvConfidence==='high'?'#16a34a':comps.arvConfidence==='medium'?'#d97706':'#dc2626' }}>
                {comps.arvConfidence}
              </span>
            </div>
            {input.isWaterfront && <div style={{ marginTop:6, fontSize:11, color:'#2980b9' }}>🌊 Waterfront premium included</div>}
            {input.hasPool      && <div style={{ marginTop:4,  fontSize:11, color:'#1a8a82' }}>🏊 Pool premium included</div>}
          </div>

          <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:10, padding:14 }}>
            <div style={{ fontWeight:600, color:'#1F3A5F', marginBottom:4, fontSize:12 }}>Market notes</div>
            <div style={{ fontSize:12, color:'#6B7C93', lineHeight:1.6 }}>{comps.neighborhoodNotes}</div>
          </div>
        </div>
      </div>

      {/* ── RISK FLAGS ── */}
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>Risk flags</div>
        {risks.map(r => <RiskBadge key={r.id} r={r} />)}
      </div>
    </div>
  );
}
