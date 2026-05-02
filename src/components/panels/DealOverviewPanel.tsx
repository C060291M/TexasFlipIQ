'use client';
import type { PropertyInput, RehabResult, DealResult, RiskFlag } from '@/types';

const fmt = (n: number) => isNaN(n)||!isFinite(n) ? '--' : '$'+Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:0});
const pct = (n: number) => isNaN(n)||!isFinite(n) ? '--' : (Math.round(n*10)/10)+'%';

function Card({ label, value, sub, tone }: { label:string; value:string; sub?:string; tone?:'good'|'warn'|'bad' }) {
  const color = tone==='good' ? '#15803d' : tone==='warn' ? '#d97706' : tone==='bad' ? '#dc2626' : '#111';
  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:'14px 16px' }}>
      <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:600, fontFamily:'monospace', color }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function RiskBadge({ r }: { r: RiskFlag }) {
  const bg = r.severity==='danger' ? '#fee2e2' : r.severity==='warning' ? '#fef3c7' : '#eff6ff';
  const border = r.severity==='danger' ? '#ef4444' : r.severity==='warning' ? '#f59e0b' : '#3b82f6';
  const color = r.severity==='danger' ? '#7f1d1d' : r.severity==='warning' ? '#78350f' : '#1e3a5f';
  const icon = r.severity==='danger' ? '🚨' : r.severity==='warning' ? '⚠' : 'ℹ';
  return (
    <div style={{ background:bg, borderLeft:`3px solid ${border}`, color, borderRadius:6, padding:'10px 12px', marginBottom:8, fontSize:12, lineHeight:1.5 }}>
      <div style={{ fontWeight:600 }}>{icon} {r.title}</div>
      <div style={{ marginTop:2, opacity:0.85 }}>{r.description}</div>
      {r.mitigation && <div style={{ marginTop:4, fontStyle:'italic', opacity:0.75 }}>Fix: {r.mitigation}</div>}
    </div>
  );
}

export function DealOverviewPanel({ input, rehab, deal, risks }: { input:PropertyInput; rehab:RehabResult; deal:DealResult; risks:RiskFlag[] }) {
  const isFlip = input.exitStrategy === 'flip';
  const score = deal.dealScore;
  const scoreColor = score.score>=70 ? '#16a34a' : score.score>=45 ? '#d97706' : '#dc2626';
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

  const rowBg: Record<string,string> = { pos:'#f0fdf4', neg:'#fef2f2', neutral:'#f9fafb', total:'#f3f4f6' };
  const rowColor: Record<string,string> = { pos:'#14532d', neg:'#7f1d1d', neutral:'#111', total:'#111' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Score */}
      <div style={{ display:'flex', alignItems:'center', gap:20, background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:20 }}>
        <div style={{ position:'relative', width:80, height:80, flexShrink:0 }}>
          <svg viewBox="0 0 80 80" style={{ width:80, height:80, transform:'rotate(-90deg)' }}>
            <circle cx="40" cy="40" r="32" fill="none" stroke="#f3f4f6" strokeWidth="7" />
            <circle cx="40" cy="40" r="32" fill="none" stroke={scoreColor} strokeWidth="7" strokeDasharray={`${arc} 201.1`} strokeLinecap="round" />
          </svg>
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:600, color:scoreColor }}>{score.score}</div>
        </div>
        <div>
          <div style={{ fontSize:20, fontWeight:600, color:scoreColor, marginBottom:4 }}>{score.label} — Grade {score.grade}</div>
          <div style={{ fontSize:13, color:'#6b7280', lineHeight:1.6 }}>{score.explanation}</div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{rehab.regionLabel} · {input.condition} · {input.sqft.toLocaleString()} sqft · built {input.yearBuilt}</div>
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
          <div style={{ fontSize:13, fontWeight:500, marginBottom:10 }}>Profit waterfall</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {rows.map((row,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', borderRadius:6, background:rowBg[row.t], color:rowColor[row.t], fontWeight:row.t==='total'?600:400, fontSize:13 }}>
                <span>{row.l}</span><span style={{ fontFamily:'monospace' }}>{row.v}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize:13, fontWeight:500, marginBottom:10 }}>Risk flags ({risks.length})</div>
          {risks.map(r => <RiskBadge key={r.id} r={r} />)}
        </div>
      </div>
    </div>
  );
}
