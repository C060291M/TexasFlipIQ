'use client';
import type { PropertyInput, RehabResult, DealResult, RiskFlag } from '@/types';

const fmt = (n: number) => isNaN(n)||!isFinite(n) ? '--' : '$'+Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:0});
const pct = (n: number) => isNaN(n)||!isFinite(n) ? '--' : (Math.round(n*10)/10)+'%';

function Card({ label, value, sub, tone }: { label:string; value:string; sub?:string; tone?:'good'|'warn'|'bad' }) {
  const color = tone==='good' ? '#22c55e' : tone==='warn' ? '#BF5700' : tone==='bad' ? '#CC0000' : '#f5f5f5';
  return (
    <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:10, padding:'14px 16px' }}>
      <div style={{ fontSize:11, color:'#666', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, fontFamily:'monospace', color }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#555', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function RiskBadge({ r }: { r: RiskFlag }) {
  const styles = {
    danger:  { bg:'#1a0000', border:'#CC0000', color:'#ff6b6b', icon:'🚨' },
    warning: { bg:'#1a0e00', border:'#BF5700', color:'#ff9944', icon:'⚠' },
    info:    { bg:'#001020', border:'#3b82f6', color:'#60a5fa', icon:'ℹ' },
  };
  const st = styles[r.severity];
  return (
    <div style={{ background:st.bg, borderLeft:`3px solid ${st.border}`, borderRadius:6, padding:'10px 12px', marginBottom:8, fontSize:12, lineHeight:1.5 }}>
      <div style={{ fontWeight:600, color:st.color }}>{st.icon} {r.title}</div>
      <div style={{ marginTop:2, color:'#aaa' }}>{r.description}</div>
      {r.mitigation && <div style={{ marginTop:4, color:'#777', fontStyle:'italic' }}>Fix: {r.mitigation}</div>}
    </div>
  );
}

export function DealOverviewPanel({ input, rehab, deal, risks }: { input:PropertyInput; rehab:RehabResult; deal:DealResult; risks:RiskFlag[] }) {
  const isFlip = input.exitStrategy === 'flip';
  const score = deal.dealScore;
  const scoreColor = score.score>=70 ? '#22c55e' : score.score>=45 ? '#BF5700' : '#CC0000';
  const arc = (score.score / 100) * 201.1;

  const flipRows = [
    { l:'ARV', v:fmt(input.arv), t:'pos' },
    { l:'− Purchase price', v:fmt(input.purchasePrice), t:'neg' },
    { l:'− Rehab cost', v:fmt(rehab.total), t:'neg' },
    { l:'− Carrying costs', v:fmt(deal.loan.totalCarryingCost), t:'neg' },
    { l:'− Closing costs (buy)', v:fmt(deal.texasCosts.titleEscrowBuy), t:'neg' },
    { l:'− Property tax', v:fmt(deal.texasCosts.propertyTax), t:'neg' },
    { l:'− Realtor + sell closing', v:fmt(deal.texasCosts.realtorCommission + deal.texasCosts.titleEscrowSell), t:'neg' },
    { l:'Net profit', v:fmt(deal.flip?.netProfit ?? 0), t:'total' },
  ];

  const rentalRows = [
    { l:'Gross annual rent', v:fmt((deal.rental?.grossMonthlyRent??0)*12), t:'pos' },
    { l:'− Operating expenses', v:fmt(deal.rental?.operatingExpenses??0), t:'neg' },
    { l:'= NOI', v:fmt(deal.rental?.noi??0), t:'neutral' },
    { l:'− Annual debt service', v:fmt(deal.rental?.annualDebtService??0), t:'neg' },
    { l:'= Annual cash flow', v:fmt(deal.rental?.annualCashFlow??0), t:'total' },
  ];

  const rows = isFlip ? flipRows : rentalRows;
  const rowStyle: Record<string, React.CSSProperties> = {
    pos:     { background:'#001a08', color:'#22c55e' },
    neg:     { background:'#1a0000', color:'#ff6b6b' },
    neutral: { background:'#1a1a1a', color:'#f5f5f5' },
    total:   { background:'#111', border:'1px solid #333', color:'#f5f5f5', fontWeight:700 },
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Score */}
      <div style={{ display:'flex', alignItems:'center', gap:20, background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:12, padding:20 }}>
        <div style={{ position:'relative', width:80, height:80, flexShrink:0 }}>
          <svg viewBox="0 0 80 80" style={{ width:80, height:80, transform:'rotate(-90deg)' }}>
            <circle cx="40" cy="40" r="32" fill="none" stroke="#222" strokeWidth="7" />
            <circle cx="40" cy="40" r="32" fill="none" stroke={scoreColor} strokeWidth="7" strokeDasharray={`${arc} 201.1`} strokeLinecap="round" />
          </svg>
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:scoreColor }}>{score.score}</div>
        </div>
        <div>
          <div style={{ fontSize:20, fontWeight:700, color:scoreColor, marginBottom:4 }}>{score.label} — Grade {score.grade}</div>
          <div style={{ fontSize:13, color:'#888', lineHeight:1.6 }}>{score.explanation}</div>
          <div style={{ fontSize:11, color:'#555', marginTop:4 }}>{rehab.regionLabel} · {input.condition} · {input.sqft.toLocaleString()} sqft · built {input.yearBuilt}</div>
        </div>
      </div>

      {/* Metrics */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
        {isFlip ? <>
          <Card label="Net profit" value={fmt(deal.flip?.netProfit??0)} sub="After all TX costs" tone={(deal.flip?.netProfit??0)>30000?'good':(deal.flip?.netProfit??0)>0?'warn':'bad'} />
          <Card label="ROI" value={pct(deal.flip?.roi??0)} sub="Return on invested" tone={(deal.flip?.roi??0)>18?'good':(deal.flip?.roi??0)>10?'warn':'bad'} />
          <Card label="Annualized ROI" value={pct(deal.flip?.annualizedRoi??0)} sub={`${input.holdingMonths}mo hold adjusted`} />
          <Card label="ARV" value={fmt(input.arv)} sub="After repair value" />
          <Card label="Max offer (70% rule)" value={fmt(deal.flip?.maxAllowableOffer??0)} sub="MAO" />
          <Card label="Total project cost" value={fmt(deal.flip?.totalProjectCost??0)} sub="All-in" />
        </> : <>
          <Card label="Annual cash flow" value={fmt(deal.rental?.annualCashFlow??0)} sub="After expenses + debt" tone={(deal.rental?.annualCashFlow??0)>5000?'good':(deal.rental?.annualCashFlow??0)>0?'warn':'bad'} />
          <Card label="Cash-on-cash return" value={pct(deal.rental?.cashOnCashReturn??0)} sub="Annual CoC ROI" tone={(deal.rental?.cashOnCashReturn??0)>10?'good':(deal.rental?.cashOnCashReturn??0)>5?'warn':'bad'} />
          <Card label="DSCR" value={`${deal.rental?.dscr?.toFixed(2)??'--'}x`} sub="Debt coverage ratio" tone={(deal.rental?.dscr??0)>1.25?'good':(deal.rental?.dscr??0)>1?'warn':'bad'} />
          <Card label="Monthly rent" value={fmt(deal.rental?.grossMonthlyRent??0)} sub={input.exitStrategy==='str'?'Avg nightly × occupancy':'Gross monthly'} />
          <Card label="NOI (annual)" value={fmt(deal.rental?.noi??0)} sub="Net operating income" />
          <Card label="Cap rate" value={pct(deal.rental?.capRate??0)} sub="Unleveraged return" />
        </>}
      </div>

      {/* Waterfall + Risks */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#BF5700', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>Profit waterfall</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {rows.map((row,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', borderRadius:6, fontSize:13, ...rowStyle[row.t] }}>
                <span>{row.l}</span>
                <span style={{ fontFamily:'monospace' }}>{row.v}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#BF5700', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>Risk flags ({risks.length})</div>
          {risks.map(r => <RiskBadge key={r.id} r={r} />)}
        </div>
      </div>
    </div>
  );
}
