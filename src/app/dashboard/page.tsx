'use client';

import { useState, useMemo, useCallback } from 'react';
import type { PropertyInput } from '@/types';
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
  sqft: 1650,
  yearBuilt: 1978,
  zipCode: '78701',
  city: 'Austin',
  address: '',
  propertyType: 'sfr',
  condition: 'moderate',
  bedrooms: 3,
  bathrooms: 2,
  exitStrategy: 'flip',
  purchasePrice: 185000,
  arv: 310000,
  holdingMonths: 5,
  hardMoneyRate: 11.5,
  hardMoneyPoints: 2,
  ltv: 70,
  hasFoundationIssues: false,
};

export default function Dashboard() {
  const [input, setInput]         = useState<PropertyInput>(DEFAULT_INPUT);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const updateInput = useCallback(
    (field: keyof PropertyInput, value: PropertyInput[keyof PropertyInput]) =>
      setInput(prev => ({ ...prev, [field]: value })),
    []
  );

  const rehab = useMemo(() => calculateRehab(input), [input]);
  const deal  = useMemo(() => calculateDeal(input, rehab), [input, rehab]);
  const risks = useMemo(() => analyzeRisks(input, rehab, deal), [input, rehab, deal]);
  const comps = useMemo(() => generateComps(input), [input]);
  const recs  = useMemo(() => generateRecommendations(input, rehab, deal, comps), [input, rehab, deal, comps]);

  const dangerCount  = risks.filter(r => r.severity === 'danger').length;
  const warningCount = risks.filter(r => r.severity === 'warning').length;
  const score = deal.dealScore;
  const scoreColor = score.score >= 70 ? '#22c55e' : score.score >= 45 ? '#BF5700' : '#CC0000';

  const addressLine = input.address
    ? `${input.address}${input.city ? ', ' + input.city : ''} ${input.zipCode}`
    : input.city
    ? `${input.city}, TX ${input.zipCode}`
    : `TX ${input.zipCode}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui,sans-serif', background: '#111', color: '#f5f5f5' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #222', background: '#000' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Texas<span style={{ color: '#BF5700' }}>Flip</span><span style={{ color: '#CC0000' }}>IQ</span>
          </div>
          {addressLine && (
            <div style={{ fontSize: 12, color: '#888', borderLeft: '1px solid #333', paddingLeft: 16 }}>
              📍 {addressLine}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {dangerCount > 0 && (
            <span style={{ fontSize: 11, background: '#2d0000', color: '#CC0000', border: '1px solid #CC0000', padding: '3px 10px', borderRadius: 20 }}>
              🚨 {dangerCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span style={{ fontSize: 11, background: '#1f1000', color: '#BF5700', border: '1px solid #BF5700', padding: '3px 10px', borderRadius: 20 }}>
              ⚠ {warningCount} warnings
            </span>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 20, border: `1px solid ${scoreColor}`, color: scoreColor, background: '#1a1a1a' }}>
            Deal Score {score.score}/100 ({score.grade})
          </span>
        </div>
      </header>

      {/* Tabs */}
      <nav style={{ display: 'flex', borderBottom: '1px solid #222', background: '#0a0a0a', padding: '0 16px' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '11px 20px', fontSize: 13, border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #BF5700' : '2px solid transparent',
              background: 'none', cursor: 'pointer',
              color: activeTab === tab.id ? '#fff' : '#666',
              fontWeight: activeTab === tab.id ? 600 : 400,
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </nav>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <PropertySidebar input={input} onUpdate={updateInput} />
        <main style={{ flex: 1, overflowY: 'auto', padding: 20, background: '#111' }}>
          {activeTab === 'overview'  && <DealOverviewPanel input={input} rehab={rehab} deal={deal} risks={risks} />}
          {activeTab === 'rehab'     && <RehabBreakdownPanel input={input} rehab={rehab} />}
          {activeTab === 'strategy'  && <StrategyPanel input={input} rehab={rehab} deal={deal} recommendations={recs} />}
          {activeTab === 'comps'     && <CompsPanel input={input} comps={comps} risks={risks} />}
        </main>
      </div>
    </div>
  );
}
