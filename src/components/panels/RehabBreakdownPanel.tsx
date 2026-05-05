'use client';
import type { PropertyInput, RehabResult } from '@/types';

const fmt = (n: number) =>
  '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

const COLORS = [
  '#1F3A5F','#2EC4B6','#E07B2A','#6B7C93',
  '#2980b9','#1a8a82','#935116','#C0392B','#888',
];

const ITEM_LABELS: Record<string, string> = {
  kitchen:    '🍳 Kitchen',
  bathrooms:  '🚿 Bathrooms',
  flooring:   '🪵 Flooring',
  roof:       '🏠 Roof',
  hvac:       '❄️ HVAC',
  electrical: '⚡ Electrical',
  plumbing:   '🔧 Plumbing',
  paint:      '🎨 Paint',
  foundation: '🏗 Foundation',
  landscaping:'🌿 Landscaping',
  windows:    '🪟 Windows',
  doors:      '🚪 Doors',
  furnishing: '🛋 Furnishing',
  hotTub:     '♨️ Hot Tub',
  pool:       '🏊 Pool',
  contingency:'🛡 Contingency',
};

// Items that belong to each quick-select category
const COSMETIC_ITEMS    = ['paint', 'flooring', 'landscaping', 'doors', 'kitchen', 'bathrooms', 'contingency'];
const STRUCTURAL_ITEMS  = ['roof', 'hvac', 'electrical', 'plumbing', 'foundation', 'windows', 'contingency'];

interface Props {
  input:        PropertyInput;
  rehab:        RehabResult;
  enabledItems: Record<string, boolean>;
  onToggle:     (key: string) => void;
  onSetEnabled: (val: Record<string, boolean>) => void;
}

export function RehabBreakdownPanel({
  input, rehab, enabledItems, onToggle, onSetEnabled,
}: Props) {
  const allEntries  = Object.entries(rehab.lineItems).filter(([, v]) => v > 0);
  const allKeys     = allEntries.map(([k]) => k);

  const activeItems = allEntries.filter(([k]) => enabledItems[k] !== false);
  const zeroedItems = allEntries.filter(([k]) => enabledItems[k] === false);
  const adjustedTotal = activeItems.reduce((a, [, v]) => a + v, 0);
  const savedAmount   = zeroedItems.reduce((a, [, v]) => a + v, 0);

  const ageMult =
    input.yearBuilt < 1970 ? '1.20×' :
    input.yearBuilt < 1985 ? '1.14×' :
    input.yearBuilt < 2000 ? '1.04×' : '1.00×';

  // Quick-select handlers
  const handleAllItems = () =>
    onSetEnabled(Object.fromEntries(allKeys.map(k => [k, true])));

  const handleCosmeticOnly = () =>
    onSetEnabled(Object.fromEntries(
      allKeys.map(k => [k, COSMETIC_ITEMS.includes(k)])
    ));

  const handleStructuralOnly = () =>
    onSetEnabled(Object.fromEntries(
      allKeys.map(k => [k, STRUCTURAL_ITEMS.includes(k)])
    ));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          ['Full estimate',   fmt(rehab.total),     'All items',         '#1F3A5F'],
          ['Adjusted total',  fmt(adjustedTotal),   'Active items only', '#2EC4B6'],
          ['Scope reduction', fmt(savedAmount),     `${zeroedItems.length} item${zeroedItems.length!==1?'s':''} zeroed`, '#E07B2A'],
          ['Cost per sqft',   input.sqft > 0 ? `${fmt(Math.round(adjustedTotal/input.sqft))}/sqft` : '--', 'Adjusted', '#6B7C93'],
        ].map(([l, v, s, c]) => (
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
          <div style={{ fontSize:13 }}>
            <strong style={{ color:'#1a8a82' }}>✓ Scope adjusted — </strong>
            <span style={{ color:'#1F3A5F' }}>
              Saving <strong>{fmt(savedAmount)}</strong> by zeroing {zeroedItems.length} item{zeroedItems.length!==1?'s':''}.{' '}
              <strong>Profit waterfall and deal score updated automatically.</strong>
            </span>
          </div>
          <button
            onClick={handleAllItems}
            style={{ fontSize:11, padding:'4px 12px', border:'1px solid #2EC4B6', borderRadius:6, background:'#fff', color:'#1a8a82', cursor:'pointer', fontWeight:600, whiteSpace:'nowrap', marginLeft:16 }}>
            Reset all
          </button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Toggle table */}
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>
            Toggle items on / off
          </div>

          {/* Quick-select buttons */}
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <button
              onClick={handleAllItems}
              style={{ flex:1, padding:'7px', border:'1px solid #DDE3EC', borderRadius:6, background:'#fff', color:'#1F3A5F', cursor:'pointer', fontSize:12, fontWeight:600 }}>
              ✓ All items
            </button>
            <button
              onClick={handleCosmeticOnly}
              style={{ flex:1, padding:'7px', border:'1px solid #DDE3EC', borderRadius:6, background:'#fff', color:'#1F3A5F', cursor:'pointer', fontSize:12, fontWeight:600 }}>
              🎨 Cosmetic only
            </button>
            <button
              onClick={handleStructuralOnly}
              style={{ flex:1, padding:'7px', border:'1px solid #DDE3EC', borderRadius:6, background:'#fff', color:'#1F3A5F', cursor:'pointer', fontSize:12, fontWeight:600 }}>
              🏗 Structural only
            </button>
          </div>

          <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:10, overflow:'hidden', boxShadow:'0 1px 3px rgba(31,58,95,0.06)' }}>
            {allEntries.map(([key, val], i) => {
              const isOn = enabledItems[key] !== false;
              return (
                <div
                  key={key}
                  style={{ display:'flex', alignItems:'center', padding:'11px 16px', borderBottom:i<allEntries.length-1?'1px solid #F0F2F5':'none', background:isOn?'#fff':'#F5F6F8', opacity:isOn?1:0.55, transition:'all 0.2s' }}>

                  {/* Toggle switch */}
                  <div
                    onClick={() => onToggle(key)}
                    style={{ width:36, height:20, borderRadius:10, background:isOn?'#2EC4B6':'#DDE3EC', position:'relative', cursor:'pointer', flexShrink:0, marginRight:12, transition:'background 0.2s' }}>
                    <div style={{ width:16, height:16, borderRadius:8, background:'#fff', position:'absolute', top:2, left:isOn?18:2, transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>

                  {/* Color dot */}
                  <div style={{ width:10, height:10, borderRadius:2, background:isOn?COLORS[i%COLORS.length]:'#ccc', flexShrink:0, marginRight:10 }} />

                  {/* Label */}
                  <span style={{ flex:1, fontSize:13, color:isOn?'#1F3A5F':'#9ca3af', fontWeight:isOn?500:400 }}>
                    {ITEM_LABELS[key] || key}
                  </span>

                  {/* Amount */}
                  <span style={{ fontFamily:'monospace', fontSize:13, color:isOn?'#1F3A5F':'#9ca3af', marginRight:12 }}>
                    {isOn
                      ? fmt(val)
                      : <span style={{ textDecoration:'line-through', color:'#ccc' }}>{fmt(val)}</span>}
                  </span>

                  {/* Percent */}
                  <span style={{ fontSize:11, color:'#6B7C93', width:36, textAlign:'right' }}>
                    {isOn ? ((val / rehab.total) * 100).toFixed(0) + '%' : '—'}
                  </span>
                </div>
              );
            })}

            {/* Total row */}
            <div style={{ display:'flex', alignItems:'center', padding:'12px 16px', background:'#1F3A5F' }}>
              <div style={{ width:36, marginRight:12 }} />
              <div style={{ width:10, marginRight:10 }} />
              <span style={{ flex:1, fontSize:13, fontWeight:700, color:'#fff' }}>
                Adjusted total
                {savedAmount > 0 && (
                  <span style={{ fontSize:11, fontWeight:400, color:'#A8BFDA', marginLeft:8 }}>
                    ({fmt(savedAmount)} removed)
                  </span>
                )}
              </span>
              <span style={{ fontFamily:'monospace', fontSize:14, fontWeight:700, color:'#2EC4B6', marginRight:12 }}>
                {fmt(adjustedTotal)}
              </span>
              <span style={{ width:36 }} />
            </div>
          </div>
        </div>

        {/* Bar chart + engine details */}
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:'#1F3A5F', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>
            Budget allocation
          </div>
          <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:10, padding:16, marginBottom:14, boxShadow:'0 1px 3px rgba(31,58,95,0.06)' }}>
            {allEntries.map(([key, val], i) => {
              const isOn = enabledItems[key] !== false;
              return (
                <div key={key} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10, opacity:isOn?1:0.3 }}>
                  <span style={{ fontSize:11, color:'#6B7C93', width:110, textAlign:'right', flexShrink:0 }}>
                    {ITEM_LABELS[key] || key}
                  </span>
                  <div style={{ flex:1, background:'#F0F2F5', borderRadius:4, height:8 }}>
                    <div style={{ width:isOn?`${(val/rehab.total)*100}%`:'0%', height:8, borderRadius:4, background:COLORS[i%COLORS.length], transition:'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize:11, fontFamily:'monospace', width:52, color:'#1F3A5F', flexShrink:0 }}>
                    {isOn ? fmt(val) : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Pricing engine details */}
          <div style={{ background:'#FFFFFF', border:'1px solid #DDE3EC', borderRadius:10, padding:16, boxShadow:'0 1px 3px rgba(31,58,95,0.06)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#1F3A5F', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
              Pricing engine
            </div>
            {[
              ['Region',         rehab.regionLabel],
              ['Labor mult',     `${rehab.laborMultiplier.toFixed(2)}×`],
              ['Age adjustment', `${ageMult} (${input.yearBuilt})`],
              ['Strategy',       input.exitStrategy.toUpperCase()],
              ['Finish level',   rehab.finishLevel],
              ['Contingency',    input.condition==='light'||input.condition==='moderate'?'10%':'15%'],
            ].map(([l, v]) => (
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
