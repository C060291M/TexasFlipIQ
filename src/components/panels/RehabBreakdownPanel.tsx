'use client';
import { useState } from 'react';
import type { PropertyInput, RehabResult } from '@/types';
import { getRegionalPricing } from '@/lib/engines/rehabEngine';

const fmt = (n: number) => '$'+Math.abs(n).toLocaleString('en-US',{maximumFractionDigits:0});
const COLORS = ['#1F3A5F','#2EC4B6','#E07B2A','#6B7C93','#2980b9','#1a8a82','#935116','#C0392B','#888'];

const ITEM_LABELS: Record<string, string> = {
  kitchen:     '🍳 Kitchen',
  bathrooms:   '🚿 Bathrooms',
  flooring:    '🪵 Flooring',
  roof:        '🏠 Roof',
  hvac:        '❄️ HVAC',
  electrical:  '⚡ Electrical',
  plumbing:    '🔧 Plumbing',
  paint:       '🎨 Paint',
  foundation:  '🏗 Foundation',
  landscaping: '🌿 Landscaping',
  windows:     '🪟 Windows',
  doors:       '🚪 Doors',
  furnishing:  '🛋 Furnishing',
  hotTub:      '♨️ Hot Tub',
  contingency: '🛡 Contingency',
};

export function RehabBreakdownPanel({ input, rehab }: { input: PropertyInput; rehab: RehabResult }) {
  // Track which items are enabled (all on by default)
  const allKeys = Object.keys(rehab.lineItems).filter(k => (rehab.lineItems as Record<string,number>)[k] > 0);
  const initEnabled = Object.fromEntries(allKeys.map(k => [k, true]));
  const [enabled, setEnabled] = useState<Record<string,boolean>>(initEnabled);

  const toggle = (key: string) => setEnabled(prev => ({ ...prev, [key]: !prev[key] }));

  // Recalculate totals based on what's enabled
  const activeItems = Object.entries(rehab.lineItems)
    .filter(([k, v]) => v > 0 && enabled[k] !== false);
  const zeroedItems = Object.entries(rehab.lineItems)
    .filter(([k, v]) => v > 0 && enabled[k] === false);

  const adjustedTotal = activeItems.reduce((a, [,v]) => a + v, 0);
  const savedAmount   = zeroedItems.reduce((a, [,v]) => a + v, 0);
  const allEntries    = Object.entries(rehab.lineItems).filter(([,v]) => v > 0);

  const ageMult = input.yearBuilt<1970?'1.20×':input.yearBuilt<1985?'1.14×':input.yearBuilt<2000?'1.04×':'1.00×';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          ['Full rehab estimate', fmt(rehab.total), 'Before adjustments', '#1F3A5F'],
          ['Adjusted total', fmt(adjustedTotal), 'Active items only', '#2EC4B6'],
          ['Items zeroed out', fmt(savedAmount), `${zeroedItems.length} item${zeroedItems.length!==1?'s':''} skipped`, '#E07B2A'],
          ['Cost per sqft', `${fmt(Math.round(adjustedTotal/input.sqft))}/sqft`, 'Adjusted', '#6B7C93'],
        ].map(([l,v,s,c]) => (
          <div key={l} style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:10, padding:'14px 16px', boxShadow:'0 1px 3px rgba(31,58,95,0.06)' }}>
            <div style={{ fontSize:10, color:'#6B7C93', marginBottom:4, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{l}</div>
            <div style={{ fontSize:20, fontWeight:700, fontFamily:'monospace', color:c as string }}>{v}</div>
            <div style={{ fontSize:11, color:'#6B7C93', marginTop:2 }}>{s}</div>
          </div>
        ))}
      </div>

      {/* Savings banner */}
      {savedAmount > 0 && (
        <div style={{ background:'#e8faf9', border:'1px solid #2EC4B6', borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <span style={{ fontWeight:700, color:'#1a8a82' }}>✓ Scope reduction applied — </span>
            <span style={{ color:'#1F3A5F', fontSize:13 }}>You zeroed out {zeroedItems.length} item{zeroedItems.length!==1?'s':''}, saving <strong>{fmt(savedAmount)}</strong> from your rehab budget.</span>
          </div>
          <button onClick={() => setEnabled(Object.fromEntries(allKeys.map(k=>[k,true])))}
            style={{ fontSize:11, padding:'4px 12px', border:'1px solid #2EC4B6', borderRadius:6, background:'#fff', color:'#1a8a82', cursor:'pointer', fontWeight:600, whiteSpace:'nowrap' }}>
            Reset all
          </button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Line item table with toggles */}
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>
            Line items — toggle to include/exclude
          </div>
          <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:10, overflow:'hidden', boxShadow:'0 1px 3px rgba(31,58,95,0.06)' }}>
            {allEntries.map(([key, val], i) => {
              const isOn = enabled[key] !== false;
              return (
                <div key={key} style={{ display:'flex', alignItems:'center', padding:'11px 16px', borderBottom: i < allEntries.length-1 ? '1px solid #F0F2F5' : 'none', background: isOn ? '#fff' : '#F5F6F8', opacity: isOn ? 1 : 0.55, transition:'all 0.2s' }}>

                  {/* Toggle switch */}
                  <div onClick={() => toggle(key)}
                    style={{ width:36, height:20, borderRadius:10, background: isOn ? '#2EC4B6' : '#DDE3EC', position:'relative', cursor:'pointer', flexShrink:0, marginRight:12, transition:'background 0.2s' }}>
                    <div style={{ width:16, height:16, borderRadius:8, background:'#fff', position:'absolute', top:2, left: isOn ? 18 : 2, transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>

                  {/* Color dot */}
                  <div style={{ width:10, height:10, borderRadius:2, background: isOn ? COLORS[i%COLORS.length] : '#ccc', flexShrink:0, marginRight:10 }} />

                  {/* Label */}
                  <span style={{ flex:1, fontSize:13, color: isOn ? '#1F3A5F' : '#9ca3af', fontWeight: isOn ? 500 : 400 }}>
                    {ITEM_LABELS[key] || key}
                  </span>

                  {/* Amount */}
                  <span style={{ fontFamily:'monospace', fontSize:13, color: isOn ? '#1F3A5F' : '#9ca3af', marginRight:12 }}>
                    {isOn ? fmt(val) : <span style={{ textDecoration:'line-through' }}>{fmt(val)}</span>}
                  </span>

                  {/* % of total */}
                  <span style={{ fontSize:11, color:'#6B7C93', width:40, textAlign:'right' }}>
                    {isOn ? ((val/rehab.total)*100).toFixed(0)+'%' : '—'}
                  </span>
                </div>
              );
            })}

            {/* Adjusted total row */}
            <div style={{ display:'flex', alignItems:'center', padding:'12px 16px', background:'#1F3A5F', borderTop:'2px solid #DDE3EC' }}>
              <div style={{ width:36, marginRight:12 }} />
              <div style={{ width:10, marginRight:10 }} />
              <span style={{ flex:1, fontSize:13, fontWeight:700, color:'#fff' }}>Adjusted total</span>
              <span style={{ fontFamily:'monospace', fontSize:14, fontWeight:700, color:'#2EC4B6', marginRight:12 }}>{fmt(adjustedTotal)}</span>
              <span style={{ width:40 }} />
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            <button onClick={() => setEnabled(Object.fromEntries(allKeys.map(k=>[k,true])))}
              style={{ flex:1, padding:'7px', border:'1px solid #DDE3EC', borderRadius:6, background:'#fff', color:'#1F3A5F', cursor:'pointer', fontSize:12, fontWeight:600 }}>
              ✓ Enable all
            </button>
            <button onClick={() => {
              const cosmetic = ['paint','flooring','landscaping','doors'];
              setEnabled(Object.fromEntries(allKeys.map(k=>[k, cosmetic.includes(k)])));
            }}
              style={{ flex:1, padding:'7px', border:'1px solid #DDE3EC', borderRadius:6, background:'#fff', color:'#1F3A5F', cursor:'pointer', fontSize:12, fontWeight:600 }}>
              🎨 Cosmetic only
            </button>
            <button onClick={() => {
              const structural = ['roof','hvac','electrical','plumbing','foundation'];
              setEnabled(Object.fromEntries(allKeys.map(k=>[k, structural.includes(k)])));
            }}
              style={{ flex:1, padding:'7px', border:'1px solid #DDE3EC', borderRadius:6, background:'#fff', color:'#1F3A5F', cursor:'pointer', fontSize:12, fontWeight:600 }}>
              🏗 Structural only
            </button>
          </div>
        </div>

        {/* Right side — bar chart + details */}
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>Budget allocation</div>

          {/* Bar chart */}
          <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:10, padding:16, marginBottom:14, boxShadow:'0 1px 3px rgba(31,58,95,0.06)' }}>
            {allEntries.map(([key,val],i) => {
              const isOn = enabled[key] !== false;
              return (
                <div key={key} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, opacity: isOn?1:0.35 }}>
                  <span style={{ fontSize:11, color:'#6B7C93', width:110, textAlign:'right', flexShrink:0 }}>{ITEM_LABELS[key]||key}</span>
                  <div style={{ flex:1, background:'#F0F2F5', borderRadius:4, height:8 }}>
                    <div style={{ width: isOn ? `${(val/rehab.total)*100}%` : '0%', height:8, borderRadius:4, background:COLORS[i%COLORS.length], transition:'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize:11, fontFamily:'monospace', width:52, flexShrink:0, color:'#1F3A5F' }}>{isOn?fmt(val):'$0'}</span>
                </div>
              );
            })}
          </div>

          {/* Pricing details */}
          <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:10, padding:16, boxShadow:'0 1px 3px rgba(31,58,95,0.06)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#1F3A5F', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Pricing engine</div>
            {[
              ['Region', rehab.regionLabel],
              ['Labor multiplier', `${rehab.laborMultiplier.toFixed(2)}×`],
              ['Age adjustment', `${ageMult} (built ${input.yearBuilt})`],
              ['Strategy', input.exitStrategy.toUpperCase()],
              ['Finish level', rehab.finishLevel],
              ['Contingency', input.condition==='light'||input.condition==='moderate'?'10%':'15%'],
              ['Data version', rehab.pricingVersion],
            ].map(([l,v]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #F0F2F5', fontSize:13 }}>
                <span style={{ color:'#6B7C93' }}>{l}</span>
                <span style={{ fontWeight:600, color:'#1F3A5F', textTransform:'capitalize' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
