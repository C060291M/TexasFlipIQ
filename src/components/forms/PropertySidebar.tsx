'use client';

import type { PropertyInput, ExitStrategy } from '@/types';

interface Props {
  input: PropertyInput;
  onUpdate: (field: keyof PropertyInput, value: PropertyInput[keyof PropertyInput]) => void;
}

const STRATEGIES: Array<{ id: ExitStrategy; label: string; emoji: string; sub: string }> = [
  { id:'flip', label:'Fix & Flip',  emoji:'🏠', sub:'High-ROI upgrades' },
  { id:'str',  label:'STR/Airbnb', emoji:'✈',  sub:'Premium + furnish' },
  { id:'ltr',  label:'LTR/BRRRR', emoji:'📋', sub:'Durable & efficient' },
];

const inp = 'w-full px-2.5 py-1.5 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-orange-500';

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 pt-2 border-t border-gray-100">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label className="text-[11px] text-gray-500">{label}</label>{children}</div>;
}

export function PropertySidebar({ input, onUpdate }: Props) {
  const n = (f: keyof PropertyInput) => (e: React.ChangeEvent<HTMLInputElement>) => onUpdate(f, parseFloat(e.target.value) || 0);
  const s = (f: keyof PropertyInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onUpdate(f, e.target.value);

  const loan   = Math.round(input.purchasePrice * input.ltv / 100);
  const mo     = Math.round(loan * (input.hardMoneyRate / 100 / 12));
  const pts    = Math.round(loan * (input.hardMoneyPoints / 100));

  return (
    <aside className="w-72 shrink-0 border-r border-gray-200 overflow-y-auto bg-white">
      <div className="p-4 space-y-4">

        <Label>Exit Strategy</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {STRATEGIES.map(s => (
            <button key={s.id} onClick={() => onUpdate('exitStrategy', s.id)}
              className={['flex flex-col items-center p-2 rounded-lg border text-center text-xs transition-all', input.exitStrategy === s.id ? 'border-orange-500 bg-orange-50 text-orange-900' : 'border-gray-200 text-gray-500 hover:bg-gray-50'].join(' ')}>
              <span className="text-xl mb-1">{s.emoji}</span>
              <span className="font-medium leading-tight">{s.label}</span>
              <span className="text-[10px] opacity-60 mt-0.5">{s.sub}</span>
            </button>
          ))}
        </div>

        <Label>Property</Label>
        <div className="space-y-3">
          <Field label="Square footage"><input type="number" value={input.sqft} onChange={n('sqft')} min={200} max={20000} className={inp} /></Field>
          <Field label="Year built"><input type="number" value={input.yearBuilt} onChange={n('yearBuilt')} min={1900} max={2025} className={inp} /></Field>
          <Field label="Texas zip code"><input type="text" value={input.zipCode} onChange={e => onUpdate('zipCode', e.target.value)} maxLength={5} className={inp} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Beds"><input type="number" value={input.bedrooms} onChange={n('bedrooms')} min={1} max={20} className={inp} /></Field>
            <Field label="Baths"><input type="number" value={input.bathrooms} onChange={n('bathrooms'
