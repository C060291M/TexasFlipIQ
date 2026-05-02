import type { PropertyInput, CompsResult, SaleComp, RentalComp, FinishLevel } from '@/types';
import { getRegionalPricing } from '@/lib/engines/rehabEngine';

export function generateComps(input: PropertyInput): CompsResult {
  const { arv, sqft, beds, bathrooms, zipCode, yearBuilt, exitStrategy } = input;
  const isStr = exitStrategy === 'str';
  const isAustin = zipCode.startsWith('787') || zipCode.startsWith('786');

  const variances = [-0.06, -0.02, +0.03, +0.04, -0.04];
  const doms = [18, 24, 41, 12, 55];
  const sqftDeltas = [-180, +120, -60, +240, -100];
  const streets = ['Crestwood Ln','Ridgeline Dr','Meadow Ct','Bluebonnet Trl','Pecan Grove Rd'];

  const saleComps: SaleComp[] = variances.map((v, i) => {
    const soldPrice = Math.round(arv * (1 + v));
    const compSqft = sqft + sqftDeltas[i];
    return { id:`comp-${i}`, address:`${1000+i*312} ${streets[i]}, TX ${zipCode}`, soldPrice, sqft:compSqft, beds, baths:bathrooms, yearBuilt:yearBuilt+i-2, daysOnMarket:doms[i], soldDate:new Date(Date.now()-(30+i*15)*86400000).toISOString().split('T')[0], pricePerSqft:Math.round(soldPrice/compSqft), distanceMiles:Math.round((0.2+i*0.15)*10)/10, source:'simulated' as const };
  });

  const rentPct = zipCode.startsWith('787') ? 0.0070 : zipCode.startsWith('77') ? 0.0065 : zipCode.startsWith('75') ? 0.0068 : 0.0067;
  const baseRent = arv * rentPct;
  const baseAdr = isAustin ? arv * 0.00095 : arv * 0.00082;
  const occ = isAustin ? 0.73 : 0.68;

  const rentalComps: RentalComp[] = isStr ? [
    { id:'str-1', address:`AirDNA Estimate — ${zipCode}`, monthlyRent:Math.round(baseAdr*30*occ), sqft, beds, baths:bathrooms, type:'str', avgDailyRate:Math.round(baseAdr), occupancyRate:occ, annualRevenue:Math.round(baseAdr*365*occ), source:'simulated' },
    { id:'str-2', address:`Mashvisor Estimate — ${zipCode}`, monthlyRent:Math.round(baseAdr*30*(occ-0.03)*0.96), sqft:sqft-50, beds, baths:bathrooms, type:'str', avgDailyRate:Math.round(baseAdr*0.96), occupancyRate:occ-0.03, annualRevenue:Math.round(baseAdr*0.96*365*(occ-0.03)), source:'simulated' },
  ] : [
    { id:'ltr-1', address:`Zillow Rent Estimate — ${zipCode}`, monthlyRent:Math.round(baseRent), sqft, beds, baths:bathrooms, type:'ltr', source:'simulated' },
    { id:'ltr-2', address:`Rentometer Median — ${zipCode}`, monthlyRent:Math.round(baseRent*0.97), sqft:sqft-40, beds, baths:bathrooms, type:'ltr', source:'simulated' },
    { id:'ltr-3', address:`MLS Active Listing — ${zipCode}`, monthlyRent:Math.round(baseRent*1.04), sqft:sqft+60, beds, baths:bathrooms, type:'ltr', source:'simulated' },
  ];

  const prices = saleComps.map(c => c.soldPrice).sort((a,b) => a-b);
  const trimmed = prices.slice(1,-1);
  const avgPsf = saleComps.reduce((a,c) => a+c.pricePerSqft, 0) / saleComps.length;
  const suggestedArv = Math.round(avgPsf * sqft);
  const low = Math.min(...trimmed), high = Math.max(...trimmed);
  const spread = (high - low) / suggestedArv;
  const arvConfidence = spread < 0.08 ? 'high' : spread < 0.15 ? 'medium' : 'low';
  const finishRecommendation: FinishLevel = avgPsf > 280 ? 'luxury' : avgPsf > 200 ? 'premium' : avgPsf > 140 ? 'standard' : 'economy';
  const avgDom = saleComps.reduce((a,c) => a+c.daysOnMarket, 0) / saleComps.length;
  const market = avgDom < 20 ? "strong seller's market" : avgDom < 35 ? 'balanced market' : 'slower market';
  const neighborhoodNotes = `${market} · $${Math.round(avgPsf)}/sqft avg · ${Math.round(avgDom)} days DOM. ${exitStrategy === 'str' ? 'STR demand strong but verify regulations before closing.' : exitStrategy === 'flip' ? `Don't exceed $${Math.round(Math.max(...saleComps.map(c=>c.soldPrice))).toLocaleString()} finish level for this neighborhood.` : 'Tenant demand typically absorbs quality units within 2–4 weeks.'}`;
  const suggestedRent = rentalComps.length ? Math.round(rentalComps.reduce((a,c) => a+c.monthlyRent, 0) / rentalComps.length) : 0;

  return { saleComps, rentalComps, suggestedArv, arvConfidence, arvRange:{low,high}, suggestedRent, finishRecommendation, neighborhoodNotes };
}
