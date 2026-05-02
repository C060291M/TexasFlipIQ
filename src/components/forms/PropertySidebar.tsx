'use client';
import type { PropertyInput, ExitStrategy } from '@/types';

interface Props {
  input: PropertyInput;
  onUpdate: (field: keyof PropertyInput, value: PropertyInput[keyof PropertyInput]) => void;
}

export function PropertySidebar({ input, onUpdate }: Props) {
  const n = (f: keyof PropertyInput) => (e: React.ChangeEvent<HTMLInputElement>) => onUpdate(f, parseFloat(e.target.value)||0);
  const s = (f: keyof PropertyInput) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) => onUpdate(f, e.target.value);

  const loan  = Math.round(input.purchasePrice * (input.ltv / 100));
  const moInt = Math.round(loan * (input.hardMoneyRate / 100 / 12));
  const pts   = Math.round(loan * (input.hardMoneyPoints / 100));

  const box: React.CSSProperties = { width:'100%', padding:'7px 10px', border:'1px solid #DDE3EC', borderRadius:6, fontSize:13, outline:'none', background:'#FFFFFF', color:'#1F3A5F', boxSizing:'border-box' };
  const lbl: React.CSSProperties = { fontSize:10, textTransform:'uppercase', letterSpacing:'0.07em', color:'#6B7C93', fontWeight:700, display:'block', marginBottom:4 };
  const sec: React.CSSProperties = { fontSize:10, textTransform:'uppercase', letterSpacing:'0.08em', color:'#2EC4B6', fontWeight:700, borderTop:'2px solid #EEF1F6', paddingTop:10, marginTop:14, display:'block' };

  return (
    <div style={{ width:272, minWidth:272, borderRight:'1px solid #DDE3EC', overflowY:'auto', background:'#FFFFFF', padding:16 }}>

      {/* Logo */}
      <div style={{ fontSize:18, fontWeight:800, marginBottom:16, color:'#1F3A5F', letterSpacing:'-0.02em' }}>
        Texas<span style={{ color:'#2EC4B6' }}>Flip</span><span style={{ color:'#2EC4B6' }}>IQ</span>
      </div>

      {/* Exit Strategy */}
      <span style={sec}>Exit Strategy</span>
      <div style={{ display:'flex', gap:6, marginTop:8 }}>
        {([['flip','🏠','Fix & Flip'],['str','✈','STR'],['ltr','📋','LTR']] as [ExitStrategy,string,string][]).map(([id,icon,label]) => (
          <button key={id} onClick={() => onUpdate('exitStrategy', id)}
            style={{ flex:1, padding:'8px 4px', border:`2px solid ${input.exitStrategy===id?'#2EC4B6':'#DDE3EC'}`, borderRadius:8, fontSize:11, cursor:'pointer', textAlign:'center', background:input.exitStrategy===id?'#e8faf9':'#F5F6F8', color:input.exitStrategy===id?'#1a8a82':'#6B7C93', lineHeight:1.3, fontWeight:input.exitStrategy===id?700:400 }}>
            <div style={{ fontSize:16 }}>{icon}</div>
            <div>{label}</div>
          </button>
        ))}
      </div>

      {/* Address */}
      <span style={sec}>Property Address</span>
      <div style={{ marginTop:8 }}>
        <label style={lbl}>Street address</label>
        <input type="text" value={input.address??''} onChange={e => onUpdate('address', e.target.value)} placeholder="e.g. 4821 Crestwood Ln" style={box} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
        <div><label style={lbl}>City</label><input type="text" value={input.city??''} onChange={e => onUpdate('city', e.target.value)} placeholder="Austin" style={box} /></div>
        <div><label style={lbl}>Zip code</label><input type="text" value={input.zipCode} onChange={e => onUpdate('zipCode', e.target.value)} maxLength={5} style={box} /></div>
      </div>

      {/* Property Details */}
      <span style={sec}>Property Details</span>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
        <div><label style={lbl}>Sqft</label><input type="number" value={input.sqft} onChange={n('sqft')} style={box} /></div>
        <div><label style={lbl}>Year built</label><input type="number" value={input.yearBuilt} onChange={n('yearBuilt')} style={box} /></div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:8 }}>
        <div><label style={lbl}>Beds</label><input type="number" value={input.bedrooms} onChange={n('bedrooms')} style={box} /></div>
        <div><label style={lbl}>Baths</label><input type="number" value={input.bathrooms} onChange={n('bathrooms')} step={0.5} style={box} /></div>
      </div>
      <div style={{ marginTop:8 }}><label style={lbl}>Property type</label>
        <select value={input.propertyType} onChange={s('propertyType')} style={box}>
          <option value="sfr">SFR</option><option value="duplex">Duplex</option>
          <option value="triplex">Triplex</option><option value="fourplex">Fourplex</option>
          <option value="condo">Condo</option><option value="townhome">Townhome</option>
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
      <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#6B7C93', marginTop:10, cursor:'pointer' }}>
        <input type="checkbox" checked={input.hasFoundationIssues??false} onChange={e => onUpdate('hasFoundationIssues', e.target.checked)} />
        Known foundation issues
      </label>

      {/* Deal Financials */}
      <span style={sec}>Deal Financials</span>
      <div style={{ marginTop:8 }}><label style={lbl}>Purchase price ($)</label><input type="number" value={input.purchasePrice} onChange={n('purchasePrice')} style={box} /></div>
      <div style={{ marginTop:8 }}><label style={lbl}>ARV ($)</label><input type="number" value={input.arv} onChange={n('arv')} style={box} /></div>
      <div style={{ marginTop:8 }}><label style={lbl}>Hold months</label><input type="number" value={input.holdingMonths} onChange={n('holdingMonths')} style={box} /></div>

      {/* Hard Money */}
      <span style={sec}>Hard Money Loan</span>
      <div style={{ marginTop:8 }}><label style={lbl}>Interest rate (%)</label><input type="number" value={input.hardMoneyRate} onChange={n('hardMoneyRate')} step={0.25} style={box} /></div>
      <div style={{ marginTop:8 }}><label style={lbl}>Points (%)</label><input type="number" value={input.hardMoneyPoints} onChange={n('hardMoneyPoints')} step={0.5} style={box} /></div>
      <div style={{ marginTop:8 }}><label style={lbl}>LTV (%)</label><input type="number" value={input.ltv} onChange={n('ltv')} style={box} /></div>

      {/* Loan preview */}
      <div style={{ background:'#F0F9F8', border:'1px solid #2EC4B6', borderRadius:8, padding:12, marginTop:12, fontSize:11 }}>
        <div style={{ fontWeight:700, color:'#1a8a82', marginBottom:6, fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>Loan summary</div>
        {[['Loan amount',`$${loan.toLocaleString()}`],['Monthly interest',`$${moInt.toLocaleString()}`],['Origination fee',`$${pts.toLocaleString()}`]].map(([l,v]) => (
          <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:4, color:'#1F3A5F' }}>
            <span style={{ color:'#6B7C93' }}>{l}</span>
            <span style={{ fontWeight:700, color:'#1F3A5F' }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ paddingBottom:16 }} />
    </div>
  );
}
