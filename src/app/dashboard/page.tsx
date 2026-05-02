'use client';

import { useState, useMemo, useCallback } from 'react';
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
  sqft: 1650, yearBuilt: 1978, zipCode: '78701',
  city: 'Austin', address: '',
  propertyType: 'sfr', condition: 'moderate',
  bedrooms: 3, bathrooms: 2, exitStrategy: 'flip',
  purchasePrice: 185000, arv: 310000,
  holdingMonths: 5, hardMoneyRate: 11.5,
  hardMoneyPoints: 2, ltv: 70,
  hasFoundationIssues: false,
};

export default function Dashboard() {
  const [input, setInput]         = useState<PropertyInput>(DEFAULT_INPUT);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [enabledItems, setEnabledItems] = useState<Record<string, boolean>>({});

  const updateInput = useCallback(
    (field: keyof PropertyInput, value: PropertyInput[keyof PropertyInput]) =>
      setInput(prev => ({ ...prev, [field]: value })),
    []
  );

  // Full rehab (all items)
  const rehab = useMemo(() => calculateRehab(input), [input]);

  // When rehab changes, reset enabled items to all-on
  useMemo(() => {
    const keys = Object.keys(rehab.lineItems).filter(
      k => (rehab.lineItems as Record<string, number>)[k] > 0
    );
    setEnabledItems(prev => {
      const next: Record<string, boolean> = {};
      keys.forEach(k => { next[k] = prev[k] !== undefined ? prev[k] : true; });
      return next;
    });
  }, [rehab]);

  // Adjusted rehab — only active toggles count toward total
  const adjustedRehab = useMemo((): RehabResult => {
    const adjustedItems = { ...rehab.lineItems };
    for (const key of Object.keys(adjustedItems)) {
      if (enabledItems[key] === false) {
        (adjustedItems as Record<string, number>)[key] = 0;
      }
    }
    const newTotal = Object.values(adjustedItems).reduce((a, b) => a + b, 0);
    return {
      ...rehab,
      lineItems: adjustedItems,
      total: Math.round(newTotal),
      perSqft: Math.round(newTotal / input.sqft),
    };
  }, [rehab, enabledItems, input.sqft]);

  // All downstream calculations use adjustedRehab
  const deal  = useMemo(() => calculateDeal(input, adjustedRehab), [input, adjustedRehab]);
  const risks = useMemo(() => analyzeRisks(input, adjustedRehab, deal), [input, adjustedRehab, deal]);
  const comps = useMemo(() => generateComps(input), [input]);
  const recs  = useMemo(() => generateRecommendations(input, adjustedRehab, deal, comps), [input, adjustedRehab, deal, comps]);

  const dangerCount  = risks.filter(r => r.severity === 'danger').length;
  const warningCount = risks.filter(r => r.severity === 'warning').length;
  const score = deal.dealScore;
  const scoreColor = score.score>=70?'#2EC4B6':score.score>=45?'#E07B2A':'#C0392B';

  const addressLine = input.address
    ? `${input.address}${input.city ? ', '+input.city : ''} ${input.zipCode}`
    : input.city ? `${input.city}, TX ${input.zipCode}` : `TX ${input.zipCode}`;

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

          {/* Rehab adjustment banner — visible on all tabs when items are zeroed */}
          {Object.values(enabledItems).some(v => v === false) && activeTab !== 'rehab' && (
            <div style={{ background:'#e8faf9', border:'1px solid #2EC4B6', borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:13 }}>
              <span>
                <strong style={{ color:'#1a8a82' }}>⚙ Rehab scope adjusted</strong>
                <span style={{ color:'#1F3A5F', marginLeft:8 }}>
                  Using <strong>${adjustedRehab.total.toLocaleString()}</strong> adjusted rehab
                  (vs <strong>${rehab.total.toLocaleString()}</strong> full estimate).
                  All calculations reflect active items only.
                </span>
              </span>
              <button
                onClick={() => setEnabledItems(prev => Object.fromEntries(Object.keys(prev).map(k => [k, true])))}
                style={{ fontSize:11, padding:'4px 12px', border:'1px solid #2EC4B6', borderRadius:6, background:'#fff', color:'#1a8a82', cursor:'pointer', fontWeight:600, whiteSpace:'nowrap', marginLeft:16 }}>
                Reset all
              </button>
            </div>
          )}

          {activeTab === 'overview'  && <DealOverviewPanel input={input} rehab={adjustedRehab} fullRehab={rehab} deal={deal} risks={risks} />}
          {activeTab === 'rehab'     && <RehabBreakdownPanel input={input} rehab={rehab} enabledItems={enabledItems} onToggle={(key) => setEnabledItems(prev => ({ ...prev, [key]: !prev[key] }))} onSetEnabled={setEnabledItems} />}
          {activeTab === 'strategy'  && <StrategyPanel input={input} rehab={adjustedRehab} deal={deal} recommendations={recs} />}
          {activeTab === 'comps'     && <CompsPanel input={input} comps={comps} risks={risks} />}
        </main>
      </div>
    </div>
  );
}
