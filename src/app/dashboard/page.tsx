'use client';

import { useState, useMemo, useCallback } from 'react';
import type { PropertyInput, ExitStrategy } from '@/types';
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
  const [input, setInput]       = useState<PropertyInput>(DEFAULT_INPUT);
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
  const score        = deal.dealScore.score;
  const scoreColor   = score >= 70 ? 'bg-green-100 text-green-800' : score >= 45 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';

  return (
    <div className="flex flex-col h-screen bg-gray-50">

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight">
            Texas<span className="text-orange-600">Flip</span>IQ
          </span>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Beta</span>
        </div>
        <div className="flex items-center gap-3">
          {dangerCount > 0 && (
            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
              🚨 {dangerCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
              ⚠ {warningCount} warning{warningCount > 1 ? 's' : ''}
            </span>
          )}
          <div className={`text-xs px-3 py-1 rounded-full font-medium ${scoreColor}`}>
            Deal Score: <strong>{score}/100</strong> ({deal.dealScore.grade})
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex border-b border-gray-200 bg-white px-4">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex items-center gap-2 px-5 py-3 text-sm border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'border-orange-500 text-gray-900 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-900',
            ].join(' ')}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <PropertySidebar input={input} onUpdate={updateInput} />
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview'  && <DealOverviewPanel  input={input} rehab={rehab} deal={deal} risks={risks} />}
          {activeTab === 'rehab'     && <RehabBreakdownPanel input={input} rehab={rehab} />}
          {activeTab === 'strategy'  && <StrategyPanel input={input} rehab={rehab} deal={deal} recommendations={recs} />}
          {activeTab === 'comps'     && <CompsPanel input={input} comps={comps} risks={risks} />}
        </main>
      </div>
    </div>
  );
}
