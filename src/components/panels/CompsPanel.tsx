'use client';
import { useState, useEffect } from 'react';
import type { PropertyInput, CompsResult, RiskFlag } from '@/types';
import { estimateMarketPrice } from '@/lib/engines/comparablesEngine';

const fmt = (n: number) =>
  '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

const pct = (n: number) => (n * 100).toFixed(0) + '%';

// ── Risk Badge ────────────────────────────────────────────────

function RiskBadge({ r }: { r: RiskFlag }) {
  const styles = {
    danger:  { bg:'#fdecea', border:'#C0392B', color:'#922b21', icon:'🚨' },
    warning: { bg:'#fef5e7', border:'#E07B2A', color:'#935116', icon:'⚠'  },
    info:    { bg:'#e8f4f8', border:'#2980b9', color:'#1a6080', icon:'ℹ'  },
  };
  const st = styles[r.severity];
  return (
    <div style={{ background:st.bg, borderLeft:`3px solid ${st.border}`, borderRadius:6, padding:'10px 14px', marginBottom:8, fontSize:12, lineHeight:1.6 }}>
      <div style={{ fontWeight:700, color:st.color }}>{st.icon} {r.title}</div>
      <div style={{ marginTop:2, color:'#1F3A5F' }}>{r.description}</div>
      {r.mitigation && (
        <div style={{ marginTop:4, color:'#6B7C93', fontStyle:'italic' }}>
          Fix: {r.mitigation}
        </div>
      )}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────

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

// ── Main Component ────────────────────────────────────────────

export function CompsPanel({ input, comps, risks, onUpdateArv }: Props) {
  const [liveComps, setLiveComps]       = useState<LiveComp[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [searched, setSearched]         = useState(false);
  const [suggestedArv, setSuggestedArv] = useState<number | null>(null);
  const [arvApplied, setArvApplied]     = useState(false);
  const [strData, setStrData]           = useState<StrData | null>(null);
  const [strLoading, setStrLoading]     = useState(false);

  const isStr = input.exitStrategy === 'str';

  // Market base — uses zip/sqft/beds only, never user ARV
  // This keeps estimates honest regardless of what user entered
  const marketBase =
    input.sqft > 0 && input.bedrooms > 0
      ? estimateMarketPrice(
          input.zipCode,
          input.sqft,
          input.bedrooms,
          input.isWaterfront,
          input.hasPool,
        )
      : 0;

  // Conservative ARV range: 60% / 70% / 80% of market base
  // Intentionally conservative — protects investors from overpaying
  const arvLow  = Math.round(marketBase * 0.60); // distressed / as-is
  const arvMid  = Math.round(marketBase * 0.70); // standard rehab
  const arvHigh = Math.round(marketBase * 0.80); // full renovation

  // Auto-fetch STR data when strategy or key inputs change
  useEffect(() => {
    if (isStr && input.zipCode) {
      fetchStrData();
    }
  }, [
    input.exitStrategy,
    input.zipCode,
    input.hasPool,
    input.isWaterfront,
    input.bedrooms,
  ]);

  const fetchStrData = async () => {
    setStrLoading(true);
    try {
      const res = await fetch(
        `/api/str` +
        `?zip=${input.zipCode}` +
        `&city=${encodeURIComponent(input.city || '')}` +
        `&beds=${input.bedrooms}` +
        `&pool=${input.hasPool || false}` +
        `&waterfront=${input.isWaterfront || false}`
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
        `/api/comps` +
        `?zip=${input.zipCode}` +
        `&city=${encodeURIComponent(input.city || '')}` +
        `&beds=${input.bedrooms}` +
        `&sqft=${input.sqft}` +
        `&year=${input.yearBuilt}` +
        `&pool=${input.hasPool || false}` +
        `&waterfront=${input.isWaterfront || false}` +
        `&address=${encodeURIComponent(input.address || '')}`
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
        // Fall back to 70% conservative market estimate
        if (marketBase > 0) {
          setSuggestedArv(arvMid);
          onUpdateArv(arvMid);
          setArvApplied(true);
        }
        setError(
          'No sold comps found for this area. ARV set to 70% of market estimate. ' +
          'Verify with a local agent before making an offer.'
        );
      }
    } catch (e) {
      if (marketBase > 0) {
        setSuggestedArv(arvMid);
        onUpdateArv(arvMid);
        setArvApplied(true);
      }
      setError('Could not load live comps. ARV set to conservative market estimate.');
    } finally {
      setLoading(false);
    }
  };

  const calcArvFromComps = (compList: LiveComp[]) => {
    const prices  = compList.map(c => c.price).sort((a, b) => a - b);
    const trimmed = prices.length > 4 ? prices.slice(1, -1) : prices;
    return Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);
  };

  const applyArv = (amount: number) => {
    onUpdateArv(amount);
    setSuggestedArv(amount);
    setArvApplied(true);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── DISCLAIMER ──────────────────────────────────────────── */}
      <div style={{ background:'#fef5e7', border:'1px solid #E07B2A', borderRadius:10, padding:'12px 16px', display:'flex', gap:10, alignItems:'flex-start' }}>
        <span style={{ fontSize:16, flexShrink:0 }}>⚠</span>
        <div style={{ fontSize:12, color:'#78350f', lineHeight:1.7 }}>
<strong>Comps are estimates — due diligence required before locking in ARV.</strong>
          {' '}All data is sourced from public records and regional market averages.
          Verify ARV with a licensed Texas realtor or local MLS access before making any offer.
          This tool is a deal screener, not an appraisal.
        </div>
      </div>

      {/* ── STR SECTION ─────────────────────────────────────────── */}
      {isStr && (
        <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:12, padding:20, boxShadow:'0 1px 3px rgba(31,58,95,0.06)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#1F3A5F' }}>
                STR market data — {input.city || input.zipCode}
              </div>
              <div style={{ fontSize:12, color:'#6B7C93', marginTop:2 }}>
                {input.bedrooms} bed
                {input.hasPool ? ' · Pool +18% ADR' : ''}
                {input.isWaterfront ? ' · Waterfront +25% ADR' : ''}
                {' · Market estimates'}
              </div>
            </div>
            <button
              onClick={fetchStrData}
              disabled={strLoading}
              style={{ padding:'8px 18px', background:strLoading?'#6B7C93':'#1F3A5F', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:strLoading?'not-allowed':'pointer' }}>
              {strLoading ? '⏳ Loading...' : '🔄 Refresh STR rates'}
            </button>
          </div>

          {strData ? (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:10 }}>
                {[
                  ['Avg daily rate',  `$${strData.adr}/night`,     '#2EC4B6'],
                  ['Occupancy',       pct(strData.occupancy),      '#1F3A5F'],
                  ['Monthly revenue', fmt(strData.monthlyRevenue),  '#1a8a82'],
                  ['Annual revenue',  fmt(strData.annualRevenue),   '#E07B2A'],
                ].map(([label, value, color]) => (
                  <div key={label} style={{ background:'#F5F6F8', borderRadius:10, padding:'12px 14px' }}>
                    <div style={{ fontSize:10, color:'#6B7C93', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>
                      {label}
                    </div>
                    <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace', color:color as string }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:11, color:'#6B7C93', borderTop:'1px solid #F0F2F5', paddingTop:8 }}>
                Source: {strData.source === 'airbnb_live' ? '✅ Live Airbnb data' : '📊 Regional market estimates'}
                {' · '}Verify with AirDNA or a local STR manager before investing.
              </div>
            </>
          ) : (
            <div style={{ background:'#F5F6F8', borderRadius:8, padding:16, textAlign:'center', fontSize:13, color:'#6B7C93' }}>
              {strLoading ? '⏳ Fetching STR rates...' : 'Click Refresh STR rates to load data'}
            </div>
          )}
        </div>
      )}

      {/* ── ARV RANGE CARD ──────────────────────────────────────── */}
      {marketBase > 0 && (
        <div style={{ background:'#FFFFFF', border:'2px solid #2EC4B6', borderRadius:12, padding:20, boxShadow:'0 1px 3px rgba(31,58,95,0.06)' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#1F3A5F', marginBottom:4 }}>
            Estimated ARV range — {input.zipCode}
            {input.isWaterfront ? ' · Waterfront' : ''}
            {input.hasPool ? ' · Pool' : ''}
          </div>
          <div style={{ fontSize:11, color:'#6B7C93', marginBottom:14 }}>
            Based on {input.sqft.toLocaleString()} sqft · {input.bedrooms}bd · {input.zipCode} regional market data.
            Ranges are intentionally conservative — 60% to 80% of median sold prices.
          </div>

          {/* Three ARV options */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
            {[
              ['Conservative', fmt(arvLow),  '#E07B2A', '60% of market', 'Distressed / as-is condition'],
              ['Moderate',     fmt(arvMid),  '#2EC4B6', '70% of market', 'Standard rehab completed'],
              ['Rehabbed',     fmt(arvHigh), '#1a8a82', '80% of market', 'Full renovation to top standard'],
            ].map(([label, value, color, badge, sub]) => (
              <div key={label} style={{ background:'#F5F6F8', borderRadius:10, padding:'16px', textAlign:'center' }}>
                <div style={{ fontSize:10, color:'#6B7C93', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>
                  {label}
                </div>
                <div style={{ display:'inline-block', fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:10, background:color as string, color:'#fff', marginBottom:8 }}>
                  {badge}
                </div>
                <div style={{ fontSize:22, fontWeight:700, fontFamily:'monospace', color:color as string, marginBottom:4 }}>
                  {value}
                </div>
                <div style={{ fontSize:10, color:'#9ca3af', marginBottom:12, lineHeight:1.4 }}>{sub}</div>
                <button
                  onClick={() => applyArv(parseInt((value as string).replace(/[^0-9]/g, '')))}
                  style={{ fontSize:11, padding:'6px 16px', background:color as string, color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontWeight:700, width:'100%' }}>
                  Use this ARV
                </button>
              </div>
            ))}
          </div>

          {/* ARV position bar */}
          {input.arv > 0 && arvHigh > arvLow && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, color:'#6B7C93', marginBottom:6 }}>
                Your ARV ({fmt(input.arv)}) position in range:
              </div>
              <div style={{ background:'#F0F2F5', borderRadius:4, height:8, position:'relative' }}>
                <div style={{ position:'absolute', left:0, right:0, top:0, bottom:0, background:'linear-gradient(to right, #E07B2A, #2EC4B6, #1a8a82)', borderRadius:4, opacity:0.35 }} />
                <div style={{
                  position:'absolute', top:-4, width:14, height:14,
                  background:'#1F3A5F', borderRadius:'50%', border:'2px solid #fff',
                  left:`${Math.min(95, Math.max(5, ((input.arv - arvLow) / Math.max(arvHigh - arvLow, 1)) * 100))}%`,
                  transform:'translateX(-50%)',
                  boxShadow:'0 1px 4px rgba(0,0,0,0.3)',
                }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#9ca3af', marginTop:4 }}>
                <span>{fmt(arvLow)} (60%)</span>
                <span>{fmt(arvMid)} (70%)</span>
                <span>{fmt(arvHigh)} (80%)</span>
              </div>
            </div>
          )}

          {/* Guidance note */}
          <div style={{ background:'#F5F6F8', borderRadius:8, padding:'10px 14px', fontSize:11, color:'#6B7C93', lineHeight:1.7 }}>
            📋 <strong style={{ color:'#1F3A5F' }}>How to use:</strong>{' '}
            Start with <strong>Moderate (70%)</strong> as your working ARV.
            Drop to <strong>Conservative (60%)</strong> if the neighborhood has weak comparable
            sales or the property needs heavy structural work.
            Use <strong>Rehabbed (80%)</strong> only after confirming strong recent sold comps
            support that price point within 0.5 miles.
            Always get at least 3 verified sold comps before finalizing your offer price.
          </div>
        </div>
      )}

      {/* ── LIVE COMPS ──────────────────────────────────────────── */}
      <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:12, padding:20, boxShadow:'0 1px 3px rgba(31,58,95,0.06)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#1F3A5F' }}>
              Comparable sold properties
            </div>
            <div style={{ fontSize:12, color:'#6B7C93', marginTop:2 }}>
              {input.sqft > 0
                ? `${Math.round(input.sqft * 0.85).toLocaleString()}–${Math.round(input.sqft * 1.15).toLocaleString()} sqft`
                : 'Enter sqft to filter'}
              {input.yearBuilt > 0 ? ` · Built ${input.yearBuilt - 15}–${input.yearBuilt + 15}` : ''}
              {input.hasPool ? ' · Pool' : ''}
              {input.isWaterfront ? ' · Waterfront' : ''}
              {' · 0.5–2 mile radius'}
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
            📍 Searching near:{' '}
            <strong>
              {input.address ? input.address + ', ' : ''}
              {input.city || 'TX'} {input.zipCode}
            </strong>
            {input.bedrooms ? ` · ${input.bedrooms} bed` : ''}
            {input.sqft > 0 ? ` · ${input.sqft.toLocaleString()} sqft` : ''}
          </div>
        )}

        {error && (
          <div style={{ background:'#fef5e7', border:'1px solid #E07B2A', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#935116', marginBottom:10, lineHeight:1.6 }}>
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
            {liveComps.map((c, i) => (
              <div key={i} style={{ background:'#F5F6F8', border:'1px solid #DDE3EC', borderRadius:10, padding:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'#2EC4B6' }}>
                    Comp {i + 1}
                  </div>
                  <div style={{ fontSize:10, color:'#6B7C93' }}>{c.distanceMiles}mi</div>
                </div>
                <div style={{ fontSize:19, fontWeight:700, fontFamily:'monospace', color:'#1F3A5F' }}>
                  {fmt(c.price)}
                </div>
                <div style={{ fontSize:11, color:'#6B7C93', marginTop:4, lineHeight:1.7 }}>
                  {c.address}<br />
                  {c.beds}bd/{c.baths}ba · {c.sqft?.toLocaleString()} sqft<br />
                  {c.yearBuilt ? `Built ${c.yearBuilt} · ` : ''}
                  {fmt(c.pricePerSqft)}/sqft<br />
                  <span style={{ color:'#2EC4B6', fontWeight:600 }}>
                    Sold {c.daysAgo} days ago
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : !searched ? (
          <div style={{ background:'#F5F6F8', borderRadius:8, padding:20, textAlign:'center', fontSize:13, color:'#6B7C93' }}>
            Enter property details then click{' '}
            <strong>Pull comps</strong> to search for recently sold comparable
            properties and auto-set ARV.
          </div>
        ) : null}

        <div style={{ marginTop:12, fontSize:11, color:'#6B7C93', borderTop:'1px solid #F0F2F5', paddingTop:8 }}>
          📡 Sources: Public records · Zillow · ATTOM Data · All free, no subscription required
        </div>
      </div>

      {/* ── MARKET ESTIMATES ────────────────────────────────────── */}
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>
          Market-calibrated estimates — {input.zipCode}
        </div>
        <div style={{ fontSize:11, color:'#6B7C93', marginBottom:10 }}>
          Regional estimates based on TX median sold data calibrated by zip code.
          Pull live comps above for actual recently sold properties.
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {comps.saleComps.slice(0, 3).map((c, i) => (
            <div key={c.id} style={{ background:'#FFFFFF', border:'1px solid #bfdbfe', borderRadius:10, padding:14 }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:'#1d4ed8', marginBottom:6 }}>
                Est. comp {i + 1}
              </div>
              <div style={{ fontSize:19, fontWeight:700, fontFamily:'monospace' }}>
                {fmt(c.soldPrice)}
              </div>
              <div style={{ fontSize:11, color:'#6B7C93', marginTop:4, lineHeight:1.7 }}>
                {c.beds}bd/{c.baths}ba · {c.sqft.toLocaleString()} sqft<br />
                Built {(c as any).yearBuilt || input.yearBuilt || '—'} · {fmt(c.pricePerSqft)}/sqft<br />
                {c.daysOnMarket} days on market
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RENTAL + ARV ANALYSIS ───────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Rental / STR detail */}
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
              ].map(([label, value]) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #F0F2F5', fontSize:13 }}>
                  <span style={{ color:'#6B7C93' }}>{label}</span>
                  <span style={{ fontWeight:600, color:'#1F3A5F' }}>{value}</span>
                </div>
              ))}
              <div style={{ fontSize:10, color:'#9ca3af', marginTop:8 }}>
                Estimates only. Verify with AirDNA or a local STR manager before investing.
              </div>
            </div>
          ) : (
            comps.rentalComps.map(c => (
              <div key={c.id} style={{ background:'#FFFFFF', border:`1px solid ${c.type==='str'?'#fcd34d':'#86efac'}`, borderRadius:10, padding:12, marginBottom:8 }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', color:c.type==='str'?'#d97706':'#16a34a', marginBottom:4 }}>
                  {c.type.toUpperCase()}
                </div>
                <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace' }}>
                  {c.type === 'str' && c.avgDailyRate
                    ? `$${c.avgDailyRate}/night`
                    : fmt(c.monthlyRent) + '/mo'}
                </div>
                {c.type === 'str' && c.monthlyRent > 0 && (
                  <div style={{ fontSize:11, color:'#6B7C93', marginTop:2 }}>
                    ~{fmt(c.monthlyRent)}/mo revenue
                  </div>
                )}
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{c.address}</div>
                {c.occupancyRate && (
                  <div style={{ fontSize:11, color:'#9ca3af' }}>
                    Occupancy: {(c.occupancyRate * 100).toFixed(0)}% · Annual: {fmt(c.annualRevenue ?? 0)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* ARV analysis */}
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>
            ARV analysis
          </div>

          <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:10, padding:16, marginBottom:10 }}>
            {input.arv > 0 ? (
              <>
                <div style={{ fontSize:11, color:'#6B7C93', marginBottom:4 }}>Your current ARV</div>
                <div style={{ fontSize:24, fontWeight:700, fontFamily:'monospace', color:'#2EC4B6', marginBottom:10 }}>
                  {fmt(input.arv)}
                </div>
              </>
            ) : (
              <div style={{ fontSize:13, color:'#6B7C93', marginBottom:10 }}>
                Pull comps or select an ARV above to get started.
              </div>
            )}

            {marketBase > 0 && (
              <>
                <div style={{ fontSize:11, color:'#6B7C93', marginBottom:6 }}>
                  Conservative range for {input.zipCode}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:8 }}>
                  <span style={{ color:'#E07B2A', fontWeight:600 }}>60%: {fmt(arvLow)}</span>
                  <span style={{ color:'#2EC4B6', fontWeight:600 }}>70%: {fmt(arvMid)}</span>
                  <span style={{ color:'#1a8a82', fontWeight:600 }}>80%: {fmt(arvHigh)}</span>
                </div>
              </>
            )}

            <div style={{ fontSize:11, color:'#6B7C93' }}>
              Confidence:{' '}
              <span style={{
                fontWeight:600,
                color: comps.arvConfidence === 'high' ? '#16a34a' :
                       comps.arvConfidence === 'medium' ? '#d97706' : '#dc2626',
              }}>
                {comps.arvConfidence}
              </span>
            </div>

            {input.isWaterfront && (
              <div style={{ marginTop:8, fontSize:11, color:'#2980b9', background:'#e8f4f8', padding:'6px 10px', borderRadius:6 }}>
                🌊 Waterfront premium included in estimates
              </div>
            )}
            {input.hasPool && (
              <div style={{ marginTop:4, fontSize:11, color:'#1a8a82', background:'#e8faf9', padding:'6px 10px', borderRadius:6 }}>
                🏊 Pool premium included in estimates
              </div>
            )}
          </div>

          <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:10, padding:14 }}>
            <div style={{ fontWeight:600, color:'#1F3A5F', marginBottom:4, fontSize:12 }}>Market notes</div>
            <div style={{ fontSize:12, color:'#6B7C93', lineHeight:1.6 }}>
              {comps.neighborhoodNotes}
            </div>
          </div>
        </div>
      </div>

      {/* ── RISK FLAGS ──────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>
          Risk flags
        </div>
        {risks.map(r => <RiskBadge key={r.id} r={r} />)}
      </div>

    </div>
  );
}
