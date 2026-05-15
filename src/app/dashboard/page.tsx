'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
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

function PrefillLoader({ onLoad }: { onLoad: (data: Partial<PropertyInput>) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const address = searchParams.get('address');
    if (address) {
      onLoad({
        address: address || '',
        city: searchParams.get('city') || '',
        zipCode: searchParams.get('zip_code') || '',
        purchasePrice: Number(searchParams.get('purchase_price')) || 0,
        arv: Number(searchParams.get('arv')) || 0,
      });
    }
  }, []);
  return null;
}

const DEFAULT_INPUT: PropertyInput = {
  sqft: 0, yearBuilt: 0, zipCode: '',
  city: '', address: '',
  propertyType: 'sfr', condition: 'moderate',
  bedrooms: 0, bathrooms: 0, exitStrategy: 'flip',
  purchasePrice: 0, arv: 0,
  holdingMonths: 5, hardMoneyRate: 11.5,
  hardMoneyPoints: 2, ltv: 70,
  hasFoundationIssues: false,
  hasPool: false,
  isWaterfront: false,
  hasGarage: false,
};

const f = (n: number) =>
  '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

const p = (n: number) =>
  (Math.round(n * 10) / 10) + '%';

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

  useEffect(() => {
    const keys = Object.keys(rehab.lineItems).filter(
      k => (rehab.lineItems as Record<string, number>)[k] > 0
    );
    setEnabledItems(prev => {
      const next: Record<string, boolean> = {};
      keys.forEach(k => { next[k] = prev[k] !== undefined ? prev[k] : true; });
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
      perSqft: input.sqft > 0 ? Math.round(total / input.sqft) : 0,
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
    : input.city
    ? `${input.city}, TX ${input.zipCode}`
    : input.zipCode
    ? `TX ${input.zipCode}`
    : '';
const sendToCRM = async () => {
    try {
      const payload = {
        address:      input?.address || '',
        city:         input?.city || '',
        state:        'TX',
        zipCode:      input?.zipCode || '',
        arv:          input?.arv || 0,
        rehabCost:    adjustedRehab?.total || 0,
        offerPrice:   input?.purchasePrice || deal?.flip?.maxAllowableOffer || 0,
        flipProfit:   deal?.flip?.netProfit || 0,
        roi:          deal?.flip?.roi || 0,
        mao:          deal?.flip?.maxAllowableOffer || 0,
        annualizedRoi: deal?.flip?.annualizedRoi || 0,
        dealScore:    score?.score || 0,
        dealGrade:    score?.grade || '',
        condition:    input?.condition || 'moderate',
        exitStrategy: input?.exitStrategy || 'Fix & Flip',
      }

      const response = await fetch('http://localhost:3000/api/send-to-crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (data.success) {
        alert('✅ Deal data sent to UnderwriteIQ CRM!\n\nGo to the CRM tab in your dashboard and click "Import from FlipIQ" on the matching lead to populate the deal numbers.')
      } else {
        alert('❌ Could not send to CRM. Make sure UnderwriteIQ is running at localhost:8000')
      }
    } catch (error) {
      alert('❌ Connection failed. Make sure both FlipIQ and UnderwriteIQ are running.')
    }
  }
  const exportPDF = async () => {
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W      = 210;
      const margin = 18;
      let y        = 0;

      // ── Header ──────────────────────────────────────────
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
      doc.text(
        new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }),
        margin, 31
      );

      const sc = score.score >= 70
        ? [46, 196, 182]
        : score.score >= 45
        ? [224, 123, 42]
        : [192, 57, 43];
      doc.setFillColor(sc[0], sc[1], sc[2]);
      doc.roundedRect(W - 62, 8, 46, 22, 4, 4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`${score.score}/100`, W - 58, 20);
      doc.setFontSize(8);
      doc.text(`Grade ${score.grade} -- ${score.label}`, W - 58, 27);

      y = 48;

      // ── Address ──────────────────────────────────────────
      doc.setTextColor(31, 58, 95);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(addressLine || 'Property Analysis', margin, y);
      y += 6;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 124, 147);
      const details = [
        adjustedRehab.regionLabel,
        input.condition + ' rehab',
        input.sqft > 0 ? input.sqft.toLocaleString() + ' sqft' : '',
        input.yearBuilt > 0 ? 'Built ' + input.yearBuilt : '',
        input.exitStrategy.toUpperCase(),
        input.isWaterfront ? 'Waterfront' : '',
        input.hasPool ? 'Pool' : '',
      ].filter(Boolean).join(' · ');
      doc.text(details, margin, y);
      y += 10;

      // ── Divider ──────────────────────────────────────────
      doc.setDrawColor(221, 227, 236);
      doc.setLineWidth(0.5);
      doc.line(margin, y, W - margin, y);
      y += 8;

      // ── Key metrics ──────────────────────────────────────
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(107, 124, 147);
      doc.text('KEY METRICS', margin, y);
      y += 5;

      const isFlip = input.exitStrategy === 'flip';

      const metrics = isFlip ? [
        ['Purchase Price',  f(input.purchasePrice)],
        ['ARV',             f(input.arv)],
        ['Rehab Cost',      f(adjustedRehab.total)],
        ['Net Profit',      f(deal.flip?.netProfit ?? 0)],
        ['ROI',             p(deal.flip?.roi ?? 0)],
        ['Annualized ROI',  p(deal.flip?.annualizedRoi ?? 0)],
        ['MAO (70% rule)',  f(deal.flip?.maxAllowableOffer ?? 0)],
        ['Total Project',   f(deal.flip?.totalProjectCost ?? 0)],
      ] : [
        ['Purchase Price',   f(input.purchasePrice)],
        ['ARV',              f(input.arv)],
        ['Rehab Cost',       f(adjustedRehab.total)],
        ['Monthly Rent',     f(deal.rental?.grossMonthlyRent ?? 0)],
        ['Annual Cash Flow', f(deal.rental?.annualCashFlow ?? 0)],
        ['Cash-on-Cash',     p(deal.rental?.cashOnCashReturn ?? 0)],
        ['Cap Rate',         p(deal.rental?.capRate ?? 0)],
        ['DSCR',             (deal.rental?.dscr?.toFixed(2) ?? '--') + 'x'],
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

      // ── Waterfall ─────────────────────────────────────────
      doc.setDrawColor(221, 227, 236);
      doc.line(margin, y, W - margin, y);
      y += 6;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(107, 124, 147);
      doc.text('PROFIT WATERFALL', margin, y);
      y += 5;

      const flipRows = [
        { l: 'ARV',                    v: f(input.arv),                                                            pos: true  },
        { l: 'Purchase Price',         v: f(input.purchasePrice),                                                  pos: false },
        { l: 'Rehab Cost',             v: f(adjustedRehab.total),                                                  pos: false },
        { l: 'Carrying Costs',         v: f(deal.loan.totalCarryingCost),                                          pos: false },
        { l: 'Closing Costs (Buy)',    v: f(deal.texasCosts.titleEscrowBuy),                                        pos: false },
        { l: 'Property Tax',           v: f(deal.texasCosts.propertyTax),                                          pos: false },
        { l: 'Realtor + Sell Closing', v: f(deal.texasCosts.realtorCommission + deal.texasCosts.titleEscrowSell),  pos: false },
        { l: 'NET PROFIT',             v: f(deal.flip?.netProfit ?? 0),                                            pos: true,  bold: true },
      ];

      const rentalRows = [
        { l: 'Gross Annual Rent',     v: f((deal.rental?.grossMonthlyRent ?? 0) * 12), pos: true  },
        { l: 'Operating Expenses',    v: f(deal.rental?.operatingExpenses ?? 0),       pos: false },
        { l: 'NOI',                   v: f(deal.rental?.noi ?? 0),                     pos: true  },
        { l: 'Annual Debt Service',   v: f(deal.rental?.annualDebtService ?? 0),       pos: false },
        { l: 'ANNUAL CASH FLOW',      v: f(deal.rental?.annualCashFlow ?? 0),          pos: true,  bold: true },
      ];

      const wfRows = isFlip ? flipRows : rentalRows;

      wfRows.forEach((row: any) => {
        if (row.bold) {
          doc.setFillColor(31, 58, 95);
          doc.rect(margin, y - 4, W - margin * 2, 8, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
        } else if (row.pos) {
          doc.setFillColor(232, 250, 249);
          doc.rect(margin, y - 4, W - margin * 2, 8, 'F');
          doc.setTextColor(26, 138, 130);
          doc.setFont('helvetica', 'normal');
        } else {
          doc.setFillColor(253, 235, 234);
          doc.rect(margin, y - 4, W - margin * 2, 8, 'F');
          doc.setTextColor(146, 43, 33);
          doc.setFont('helvetica', 'normal');
        }
        doc.setFontSize(9);
        doc.text(row.l, margin + 3, y + 1);
        doc.text(row.v, W - margin - 3, y + 1, { align: 'right' });
        y += 9;
      });

      y += 6;

      // ── Rehab breakdown ───────────────────────────────────
      doc.setDrawColor(221, 227, 236);
      doc.line(margin, y, W - margin, y);
      y += 6;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(107, 124, 147);
      doc.text('REHAB BREAKDOWN', margin, y);
      y += 5;

      const labelMap: Record<string, string> = {
        kitchen: 'Kitchen', bathrooms: 'Bathrooms', flooring: 'Flooring',
        roof: 'Roof', hvac: 'HVAC', electrical: 'Electrical',
        plumbing: 'Plumbing', paint: 'Paint', foundation: 'Foundation',
        landscaping: 'Landscaping', windows: 'Windows', doors: 'Doors',
        furnishing: 'Furnishing', hotTub: 'Hot Tub', pool: 'Pool',
        contingency: 'Contingency',
      };

      const activeItems = Object.entries(adjustedRehab.lineItems)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1]);

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
        doc.text(f(val), x + colW2 - 4, yy + 2, { align: 'right' });
      });

      y += Math.ceil(activeItems.length / 3) * 10 + 6;

      // ── Risk flags ────────────────────────────────────────
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
          const rc = risk.severity === 'danger'
            ? [192, 57, 43]
            : risk.severity === 'warning'
            ? [224, 123, 42]
            : [41, 128, 185];
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

      // ── Comp disclaimer ───────────────────────────────────
      if (y < 265) {
        y += 4;
        doc.setFillColor(254, 245, 231);
        doc.rect(margin, y - 3, W - margin * 2, 14, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(120, 53, 15);
        doc.text('IMPORTANT: ARV and comp data are estimates only.', margin + 3, y + 3);
        doc.setFont('helvetica', 'normal');
        doc.text('Verify with a licensed Texas realtor or MLS access before making any offer.', margin + 3, y + 8);
        y += 18;
      }

      // ── Footer ────────────────────────────────────────────
      doc.setFillColor(31, 58, 95);
      doc.rect(0, 282, W, 15, 'F');
      doc.setTextColor(168, 191, 218);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(
        'Generated by TexasFlipIQ -- For investment analysis only. Not financial advice.',
        margin, 291
      );
      doc.text(
        `Deal Score ${score.score}/100 -- ${score.label}`,
        W - margin, 291, { align: 'right' }
      );

      const filename = input.address
        ? `TexasFlipIQ_${input.address.replace(/\s+/g, '_')}.pdf`
        : `TexasFlipIQ_${input.zipCode || 'Deal'}.pdf`;

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
      <PrefillLoader onLoad={(data) => setInput(prev => ({ ...prev, ...data }))} />

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
          <button
            onClick={sendToCRM}
            style={{ fontSize:12, fontWeight:700, padding:'7px 16px', borderRadius:8, border:'2px solid #0F6E56', background:'#0a3d2e', color:'#2EC4B6', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            🏠 Send to CRM
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

          {/* Rehab adjustment banner */}
          {Object.values(enabledItems).some(v => v === false) && activeTab !== 'rehab' && (
            <div style={{ background:'#e8faf9', border:'1px solid #2EC4B6', borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:13 }}>
              <span>
                <strong style={{ color:'#1a8a82' }}>Rehab scope adjusted — </strong>
                <span style={{ color:'#1F3A5F' }}>
                  Using <strong>{f(adjustedRehab.total)}</strong> adjusted rehab
                  (vs <strong>{f(rehab.total)}</strong> full). All calculations updated.
                </span>
              </span>
              <button
                onClick={() => setEnabledItems(prev => Object.fromEntries(Object.keys(prev).map(k => [k, true])))}
                style={{ fontSize:11, padding:'4px 12px', border:'1px solid #2EC4B6', borderRadius:6, background:'#fff', color:'#1a8a82', cursor:'pointer', fontWeight:600, whiteSpace:'nowrap', marginLeft:16 }}>
                Reset all
              </button>
            </div>
          )}

          {activeTab === 'overview'  && <DealOverviewPanel input={input} rehab={adjustedRehab} fullRehab={rehab} deal={deal} risks={risks} onUpdatePurchasePrice={price => updateInput('purchasePrice', price)} />}
          {activeTab === 'rehab'     && <RehabBreakdownPanel input={input} rehab={rehab} enabledItems={enabledItems} onToggle={key => setEnabledItems(prev => ({ ...prev, [key]: !prev[key] }))} onSetEnabled={setEnabledItems} />}
          {activeTab === 'strategy'  && <StrategyPanel input={input} rehab={adjustedRehab} deal={deal} recommendations={recs} />}
          {activeTab === 'comps'     && <CompsPanel input={input} comps={comps} risks={risks} onUpdateArv={arv => updateInput('arv', arv)} />}
        </main>
      </div>
    </div>
  );
}
