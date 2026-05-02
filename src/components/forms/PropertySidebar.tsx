'use client';
import type { PropertyInput, ExitStrategy } from '@/types';

interface Props {
  input: PropertyInput;
  onUpdate: (field: keyof PropertyInput, value: PropertyInput[keyof PropertyInput]) => void;
}

export function PropertySidebar({ input, onUpdate }: Props) {
  const n = (f: keyof PropertyInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onUpdate(f, parseFloat(e.target.value) || 0);
  const s = (f: keyof PropertyInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onUpdate(f, e.target.value);

  const loan   = Math.round(input.purchasePrice * (input.ltv / 100));
  const moInt  = Math.round(loan * (input.hardMoneyRate / 100 / 12));
  const pts    = Math.round(loan * (input.hardMoneyPoints / 100));

  const box: React.CSSProperties = { width:'100%', padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13, outline:'none', boxSizing:'border-box' };
  const lbl: React.CSSProperties = { fontSize:10, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9ca3af', fontWeight:600, display:'block', marginBottom:4 };
  const sec: React.CSSProperties = { fontSize:10, textTransform:'uppercase', letterSpacing:'0.08em', color:'#9ca3af', fontWeight:600, borderTop:'1px solid #f3f4f6', paddingTop:10, marginTop:12, display:'block' };

  return (
    <div style={{ width:268, minWidth:268, borderRight:'1px solid #e5e7eb', overflowY:'auto', background:'#fff', padding:16 }}>

      {/* Exit Strategy */}
      <span style={sec}>Exit Strategy</span>
      <div style={{ display:'flex', gap:6, marginTop:8 }}>
        {([['flip','🏠','Fix & Flip'],['str','✈','STR'],['ltr','📋','LTR']] as [ExitStrategy,string,string][]).map(([id,icon,label]) => (
          <button key={id} onClick={() => onUpdate('exitStrategy', id)}
            style={{ flex:1, padding:'8px 4px', border:`1px solid ${input.exitStrategy===id?'#c2620a':'#e5e7eb'}`, borderRadius:8, fontSize:11, cursor:'pointer', textAlign:'center', background:input.exitStrategy===id?'#fff7f0':'#fff', color:input.exitStrategy===id?'#7a3a06':'#6b7280', lineHeight:1.3 }}>
            <div style={{ fontSize:16 }}>{icon}</div>
            <div style={{ fontWeight:500 }}>{label}</div>
          </button>
        ))}
      </div>

      {/* Property */}
      <span style={sec}>Property</span>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
        <div><label style={lbl}>Sqft</label><input type="number" value={input.sqft} onChange={n('sqft')} style={box} /></div>
        <div><label style={lbl}>Year Built</label><input type="number" value={input.yearBuilt} onChange={n('yearBuilt')} style={box} /></div>
      </div>
      <div style={{ marginTop:8 }}><label style={lbl}>Texas Zip Code</label><input type="text" value={input.zipCode} onChange={e => onUpdate('zipCode', e.target.value)} maxLength={5} style={box} /></div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
        <div><label style={lbl}>Beds</label><input type="number" value={input.bedrooms} onChange={n('bedrooms')} style={box} /></div>
        <div><label style={lbl}>Baths</label><input type="number" value={input.bathrooms} onChange={n('bathrooms')} step={0.5} style={box} /></div>
      </div>
      <div style={{ marginTop:8 }}><label style={lbl}>Property Type</label>
        <select value={input.propertyType} onChange={s('propertyType')} style={box}>
          <option value="sfr">SFR</option>
          <option value="duplex">Duplex</option>
          <option value="triplex">Triplex</option>
          <option value="fourplex">Fourplex</option>
          <option value="condo">Condo</option>
          <option value="townhome">Townhome</option>
        </select>
      </div>
      <div style={{ marginTop:8 }}><label style={lbl}>Condition</label>
        <select value={input.condition} onChange={s('condition')} style={box}>
          <option value="light">Light — cosmetic only</option>
          <option value="moderate">Moderate — systems + cosmetic</option>
          <option value="heavy">Heavy — major systems</option>
          <option value="gut">Gut — full rehab</option>
        </select>
      </div>
      <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#6b7280', marginTop:8, cursor:'pointer' }}>
        <input type="checkbox" checked={input.hasFoundationIssues ?? false} onChange={e => onUpdate('hasFoundationIssues', e.target.checked)} />
        Known foundation issues
      </label>

      {/* Financials */}
      <span style={sec}>Deal Financials</span>
      <div style={{ marginTop:8 }}><label style={lbl}>Purchase Price ($)</label><input type="number" value={input.purchasePrice} onChange={n('purchasePrice')} style={box} /></div>
      <div style={{ marginTop:8 }}><label style={lbl}>ARV ($)</label><input type="number" value={input.arv} onChange={n('arv')} style={box} /></div>
      <div style={{ marginTop:8 }}><label style={lbl}>Hold Months</label><input type="number" value={input.holdingMonths} onChange={n('holdingMonths')} style={box} /></div>

      {/* Hard Money */}
      <span style={sec}>Hard Money Loan</span>
      <div style={{ marginTop:8 }}><label style={lbl}>Interest Rate (%)</label><input type="number" value={input.hardMoneyRate} onChange={n('hardMoneyRate')} step={0.25} style={box} /></div>
      <div style={{ marginTop:8 }}><label style={lbl}>Points (%)</label><input type="number" value={input.hardMoneyPoints} onChange={n('hardMoneyPoints')} step={0.5} style={box} /></div>
      <div style={{ marginTop:8 }}><label style={lbl}>LTV (%)</label><input type="number" value={input.ltv} onChange={n('ltv')} style={box} /></div>

      {/* Loan preview */}
      <div style={{ background:'#f9fafb', borderRadius:8, padding:10, marginTop:10, fontSize:11, color:'#6b7280' }}>
        {[['Loan amount',`$${loan.toLocaleString()}`],['Monthly interest',`$${moInt.toLocaleString()}`],['Origination fee',`$${pts.toLocaleString()}`]].map(([l,v]) => (
          <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
            <span>{l}</span><span style={{ fontWeight:600, color:'#111' }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ paddingBottom:16 }} />
    </div>
  );
}
