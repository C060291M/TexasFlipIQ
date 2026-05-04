'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { PropertyInput, RehabResult } from '@/types';
import { calculateRehab } from '@/lib/engines/rehabEngine';
import { calculateDeal } from '@/lib/engines/dealCalculator';
import { analyzeRisks } from '@/lib/engines/riskAnalyzer';
import { generateComps } from '@/lib/engines/comparablesEngine';
import { generateRecommendations } from '@/lib/engines/roiOptimizer';
import { PropertySidebar } from '@/components/forms/PropertySidebar';
import { DealOverviewPanel } from '@/components/panels/DealOverviewPanel';
import { RehabBreakdownPanel } from '@/components/panels/RehabBreakdownPanel';
import { StrategyPanel } from '@/components/panels/StrategyPanel';
import { CompsPanel } from '@/components/panels/CompsPanel';

type TabId = 'overview' | 'rehab' | 'strategy' | 'comps';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'overview',  label: 'Deal Overview',      icon: '📊' },
  { id: 'rehab',     label: 'Rehab Breakdown',    icon: '🔨' },
  { id: 'strategy',  label: 'Strategy Optimizer', icon: '🎯' },
  { id: 'comps',     label: 'Comps & Risks',      icon: '🏘' },
];

const DEFAULT_INPUT: PropertyInput = {
  sqft: 0, yearBuilt: 0, zipCode: '',
  city: '', address: '',
  propertyType: 'sfr', condition: 'moderate',
  bedrooms: 0, bathrooms: 0, exitStrategy: 'flip',
  purchasePrice: 0, arv: 0,
  holdingMonths: 5, hardMoneyRate: 11.5,
  hardMoneyPoints: 2, ltv: 70,
  hasFoundationIssues: false,
};

const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
const pct = (n: number) => (Math.round(n * 10) / 10) + '%';

export default function Dashboard() {
  const [input, setInput]               = useState<PropertyInput>(DEFAULT_INPUT);
  const [activeTab, setActiveTab]       = useState<TabId>('overview');
  const [enabledItems, setEnabledItems] = useState<Record<string, boolean>>({});
  const [exporting, setExporting]       = useState(false);

  const updateInput = useCallback(
    (field: keyof PropertyInput, value: PropertyInput[keyof PropertyInput]) =>
      setInput(prev => ({ ...prev, [field]: value })),
    []
  );

  const rehab = useMemo(() => calculateRehab(input), [input]);

  // ── KEY FIX: useEffect (not useMemo) so foundation checkbox
  // and condition changes correctly update the toggle list
  useEffect(() => {
    const keys = Object.keys(rehab.lineItems).filter(
      k => (rehab.lineItems as Record<string, number>)[k] > 0
    );
    setEnabledItems(prev => {
      const next: Record<string, boolean> = {};
      keys.forEach(k => {
        // Keep existing toggle state if item was already known
        next[k] = prev[k] !== undefined ? prev[k] : true;
      });
      return next;
    });
  }, [rehab]);

  const adjustedRehab = useMemo((): RehabResult => {
    const items = { ...rehab.lineItems };
    for (const key of Object.keys(items)) {
      if (enabledItems[key] === false) {
        (items as Record<string, number>)[key] = 0;
      }
    }
    const total = Object.values(items).reduce((a, b) => a + b, 0);
    return {
      ...rehab,
      lineItems: items,
      total: Math.round(total),
      perSqft: Math.round(total / input.sqft),
    };
  }, [rehab, enabledItems, input.sqft]);

  const deal  = useMemo(() => calculateDeal(input, adjustedRehab), [input, adjustedRehab]);
  const risks = useMemo(() => analyzeRisks(input, adjustedRehab, deal), [input, adjustedRehab, deal]);
  const comps = useMemo(() => generateComps(input), [input]);
  const recs  = useMemo(() => generateRecommendations(input, adjustedRehab, deal, comps), [input, adjustedRehab, deal, comps]);

  const dangerCount  = risks.filter(r => r.severity === 'danger').length;
  const warningCount = risks.filter(r => r.severity === 'warning').length;
  const score        = deal.dealScore;
  const scoreColor   = score.score >= 70 ? '#2EC4B6' : score.score >= 45 ? '#E07B2A' : '#C0392B';

  const addressLine = input.address
    ? `${input.address}${input.city ? ', ' + input.city : ''} ${input.zipCode}`
    : input.city ? `${input.city}, TX ${input.zipCode}` : `TX ${input.zipCode}`;

  // ── PDF Export ────────────────────────────────────────────
  const exportPDF = async () => {
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = 210;
      const margin = 18;
      let y = 0;

      // Header
      doc.setFillColor(31, 58, 95);
      doc.rect(0, 0, W, 38, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('TexasFlipIQ', margin, 16);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(168, 191, 218);
      doc.text('Deal Analysis Report', margin, 24);
      doc.text(new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }), margin, 31);

      const sc = score.score >= 70 ? [46,196,182] : score.score >= 45 ? [224,123,42] : [192,57,43];
      doc.setFillColor(sc[0], sc[1], sc[2]);
      doc.roundedRect(W - 62, 8, 46, 22, 4, 4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`${score.score}/100`, W - 58, 20);
      doc.setFontSize(8);
      doc.text(`Grade ${score.grade} — ${score.label}`, W - 58, 26);

      y = 48;

      // Address
      doc.setTextColor(31, 58, 95);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(addressLine || 'Property Analysis', margin, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 124, 147);
      doc.text(`${adjustedRehab.regionLabel} · ${input.condition} rehab · ${input.sqft.toLocaleString()} sqft · Built ${input.yearBuilt} · ${input.exitStrategy.toUpperCase()}`, margin, y);
      y += 10;

      // Divider
      doc.setDrawColor(221, 227, 236);
      doc.line(margin, y, W - margin, y);
      y += 8;

      // Metrics
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(107, 124, 147);
      doc.text('KEY METRICS', margin, y);
      y += 5;

      const isFlip = input.exitStrategy === 'flip';
      const metrics = isFlip ? [
        ['Purchase Price', fmt(input.purchasePrice)],
        ['ARV',            fmt(input.arv)],
        ['Rehab Cost',     fmt(adjustedRehab.total)],
        ['Net Profit',     fmt(deal.flip?.netProfit ?? 0)],
        ['ROI',            pct(deal.flip?.roi ?? 0)],
        ['Annualized ROI', pct(deal.flip?.annualizedRoi ?? 0)],
        ['MAO (70% rule)', fmt(deal.flip?.maxAllowableOffer ?? 0)],
        ['Total Project',  fmt(deal.flip?.totalProjectCost ?? 0)],
      ] : [
        ['Purchase Price',   fmt(input.purchasePrice)],
        ['ARV',              fmt(input.arv)],
        ['Rehab Cost',       fmt(adjustedRehab.total)],
        ['Monthly Rent',     fmt(deal.rental?.grossMonthlyRent ?? 0)],
        ['Annual Cash Flow', fmt(deal.rental?.annualCashFlow ?? 0)],
        ['Cash-on-Cash',     pct(deal.rental?.cashOnCashReturn ?? 0)],
        ['Cap Rate',         pct(deal.rental?.capRate ?? 0)],
        ['DSCR',             `${deal.rental?.dscr?.toFixed(2) ?? '--'}x`],
      ];

      const colW = (W - margin * 2) / 4;
      const boxH = 18;
      metrics.forEach(([label, value], i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x   = margin + col * colW;
        const yy  = y + row * (boxH + 3);
        doc.setFillColor(245, 246, 248);
        doc.roundedRect(x, yy, colW - 2, boxH, 2, 2, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 124, 147);
        doc.text(label, x + 3, yy + 5);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 58, 95);
        doc.text(value, x + 3, yy + 13);
      });
      y += Math.ceil(metrics.length / 4) * (boxH + 3) + 8;

      // Waterfall
      doc.setDrawColor(221, 227, 236);
      doc.line(margin, y, W - margin, y);
      y += 6;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(107, 124, 147);
      doc.text('PROFIT WATERFALL', margin, y);
      y += 5;

      const rows = isFlip ? [
        { l:'ARV',                        v:fmt(input.arv),                                                              pos:true  },
        { l:'− Purchase price',           v:fmt(input.purchasePrice),                                                   pos:false },
        { l:'− Rehab cost',              v:fmt(adjustedRehab.total),                                                    pos:false },
        { l:'− Carrying costs',          v:fmt(deal.loan.totalCarryingCost),                                            pos:false },
        { l:'− Closing costs (buy)',      v:fmt(deal.texasCosts.titleEscrowBuy),                                         pos:false },
        { l:'− Property tax',            v:fmt(deal.texasCosts.propertyTax),                                            pos:false },
        { l:'− Realtor + sell closing',  v:fmt(deal.texasCosts.realtorCommission+deal.texasCosts.titleEscrowSell),      pos:false },
        { l:'NET PROFIT',                v:fmt(deal.flip?.netProfit ?? 0),                                              pos:true, bold:true },
      ] : [
        { l:'Gross annual rent',          v:fmt((deal.rental?.grossMonthlyRent??0)*12), pos:true  },
        { l:'− Operating expenses',      v:fmt(deal.rental?.operatingExpenses??0),     pos:false },
        { l:'= NOI',                     v:fmt(deal.rental?.noi??0),                   pos:true  },
        { l:'− Annual debt service',     v:fmt(deal.rental?.annualDebtService??0),     pos:false },
        { l:'ANNUAL CASH FLOW',          v:fmt(deal.rental?.annualCashFlow??0),        pos:true, bold:true },
      ];

      rows.forEach((row: any) => {
        if (row.bold) {
          doc.setFillColor(31, 58, 95);
          doc.rect(margin, y - 4, W - margin * 2, 8, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFillColor(row.pos?232:253, row.pos?250:235, row.pos?249:234);
          doc.rect(margin, y - 4, W - margin * 2, 8, 'F');
          doc.setTextColor(row.pos?26:146, row.pos?138:43, row.pos?130:33);
          doc.setFont('helvetica', 'normal');
        }
        doc.setFontSize(9);
        doc.text(row.l, margin + 3, y + 1);
        doc.text(row.v, W - margin - 3, y + 1, { align:'right' });
        y += 9;
      });
      y += 6;

      // Rehab items
      doc.setDrawColor(221, 227, 236);
      doc.line(margin, y, W - margin, y);
      y += 6;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(107, 124, 147);
      doc.text('REHAB BREAKDOWN', margin, y);
      y += 5;

      const labelMap: Record<string,string> = {
        kitchen:'Kitchen', bathrooms:'Bathrooms', flooring:'Flooring',
        roof:'Roof', hvac:'HVAC', electrical:'Electrical', plumbing:'Plumbing',
        paint:'Paint', foundation:'Foundation', landscaping:'Landscaping',
        windows:'Windows', doors:'Doors', furnishing:'Furnishing',
        hotTub:'Hot Tub', contingency:'Contingency',
      };

      const activeItems = Object.entries(adjustedRehab.lineItems)
        .filter(([,v]) => v > 0)
        .sort((a,b) => b[1]-a[1]);

      const colW2 = (W - margin * 2) / 3;
      activeItems.forEach(([key, val], i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x   = margin + col * colW2;
        const yy  = y + row * 10;
        doc.setFillColor(245, 246, 248);
        doc.rect(x, yy - 3, colW2 - 2, 9, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 124, 147);
        doc.text(labelMap[key] || key, x + 2, yy + 2);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(31, 58, 95);
        doc.text(fmt(val), x + colW2 - 4, yy + 2, { align:'right' });
      });
      y += Math.ceil(activeItems.length / 3) * 10 + 6;

      // Risk flags
      if (y < 240) {
        doc.setDrawColor(221, 227, 236);
        doc.line(margin, y, W - margin, y);
        y += 6;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(107, 124, 147);
        doc.text('RISK FLAGS', margin, y);
        y += 5;
        risks.slice(0, 4).forEach(risk => {
          const rc = risk.severity==='danger'?[192,57,43]:risk.severity==='warning'?[224,123,42]:[41,128,185];
          doc.setFillColor(rc[0], rc[1], rc[2]);
          doc.rect(margin, y - 3, 2, 8, 'F');
          doc.setFillColor(245, 246, 248);
          doc.rect(margin + 2, y - 3, W - margin * 2 - 2, 8, 'F');
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(31, 58, 95);
          doc.text(risk.title, margin + 5, y + 1);
          y += 9;
        });
      }

      // Footer
      doc.setFillColor(31, 58, 95);
      doc.rect(0, 282, W, 15, 'F');
      doc.setTextColor(168, 191, 218);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Generated by TexasFlipIQ — For investment analysis only. Not financial advice.', margin, 291);
      doc.text(`Deal Score ${score.score}/100 · ${score.label}`, W - margin, 291, { align:'right' });

      const filename = input.address
        ? `TexasFlipIQ_${input.address.replace(/\s+/g,'_')}.pdf`
        : `TexasFlipIQ_${input.zipCode}.pdf`;
      doc.save(filename);

    } catch (err) {
      console.error('PDF error:', err);
      alert('PDF export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', fontFamily:'system-ui,sans-serif', background:'#F5F6F8', color:'#1F3A5F' }}>

      {/* Header */}
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 24px', borderBottom:'1px solid #DDE3EC', background:'#1F3A5F' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ fontSize:20, fontWeight:800, letterSpacing:'-0.03em', color:'#FFFFFF' }}>
            Texas<span style={{ color:'#2EC4B6' }}>Flip</span><span style={{ color:'#2EC4B6' }}>IQ</span>
          </div>
          {addressLine && (
            <div style={{ fontSize:12, color:'#A8BFDA', borderLeft:'1px solid #2d4f7a', paddingLeft:16 }}>
              📍 {addressLine}
            </div>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {dangerCount > 0 && (
            <span style={{ fontSize:11, background:'#fdecea', color:'#C0392B', border:'1px solid #f5b7b1', padding:'4px 12px', borderRadius:20, fontWeight:600 }}>
              🚨 {dangerCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span style={{ fontSize:11, background:'#fef5e7', color:'#E07B2A', border:'1px solid #f8c471', padding:'4px 12px', borderRadius:20, fontWeight:600 }}>
              ⚠ {warningCount} warnings
            </span>
          )}
          <button
            onClick={exportPDF}
            disabled={exporting}
            style={{ fontSize:12, fontWeight:700, padding:'7px 16px', borderRadius:8, border:'2px solid #2EC4B6', background:'#1a4a40', color:'#2EC4B6', cursor:exporting?'not-allowed':'pointer', display:'flex', alignItems:'center', gap:6 }}>
            {exporting ? '⏳ Exporting...' : '📄 Export PDF'}
          </button>
          <span style={{ fontSize:11, fontWeight:700, padding:'4px 14px', borderRadius:20, border:`2px solid ${scoreColor}`, color:'#fff', background:score.score>=70?'#1a8a82':score.score>=45?'#b5601a':'#922b21' }}>
            Deal Score {score.score}/100 ({score.grade})
          </span>
        </div>
      </header>

      {/* Tabs */}
      <nav style={{ display:'flex', borderBottom:'2px solid #DDE3EC', background:'#FFFFFF', padding:'0 20px' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding:'12px 20px', fontSize:13, border:'none', borderBottom:activeTab===tab.id?'3px solid #2EC4B6':'3px solid transparent', background:'none', cursor:'pointer', color:activeTab===tab.id?'#1F3A5F':'#6B7C93', fontWeight:activeTab===tab.id?700:400, marginBottom:-2 }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </nav>

      {/* Body */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <PropertySidebar input={input} onUpdate={updateInput} />
        <main style={{ flex:1, overflowY:'auto', padding:24, background:'#F5F6F8' }}>

          {Object.values(enabledItems).some(v => v === false) && activeTab !== 'rehab' && (
            <div style={{ background:'#e8faf9', border:'1px solid #2EC4B6', borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:13 }}>
              <span>
                <strong style={{ color:'#1a8a82' }}>⚙ Rehab scope adjusted — </strong>
                <span style={{ color:'#1F3A5F' }}>
                  Using <strong>{fmt(adjustedRehab.total)}</strong> adjusted rehab (vs <strong>{fmt(rehab.total)}</strong> full). All calculations updated.
                </span>
              </span>
              <button
                onClick={() => setEnabledItems(prev => Object.fromEntries(Object.keys(prev).map(k => [k,true])))}
                style={{ fontSize:11, padding:'4px 12px', border:'1px solid #2EC4B6', borderRadius:6, background:'#fff', color:'#1a8a82', cursor:'pointer', fontWeight:600, whiteSpace:'nowrap', marginLeft:16 }}>
                Reset all
              </button>
            </div>
          )}

          {activeTab==='overview'  && <DealOverviewPanel input={input} rehab={adjustedRehab} fullRehab={rehab} deal={deal} risks={risks} />}
          {activeTab==='rehab'     && <RehabBreakdownPanel input={input} rehab={rehab} enabledItems={enabledItems} onToggle={key => setEnabledItems(prev => ({ ...prev, [key]:!prev[key] }))} onSetEnabled={setEnabledItems} />}
          {activeTab==='strategy'  && <StrategyPanel input={input} rehab={adjustedRehab} deal={deal} recommendations={recs} />}
          {activeTab==='comps'     && <CompsPanel input={input} comps={comps} risks={risks} onUpdateArv={arv => updateInput('arv', arv)} />}
        </main>
      </div>
    </div>
  );
}
