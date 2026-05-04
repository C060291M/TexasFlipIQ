import { NextRequest, NextResponse } from 'next/server';
import { estimateMarketPrice } from '@/lib/engines/comparablesEngine';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const zip        = searchParams.get('zip')        || '';
  const city       = searchParams.get('city')       || '';
  const bedsStr    = searchParams.get('beds')       || '3';
  const sqftStr    = searchParams.get('sqft')       || '1500';
  const yearStr    = searchParams.get('year')       || '1990';
  const hasPool    = searchParams.get('pool')       === 'true';
  const waterfront = searchParams.get('waterfront') === 'true';
  const beds       = parseInt(bedsStr)  || 3;
  const sqft       = parseInt(sqftStr)  || 1500;
  const yearBuilt  = parseInt(yearStr)  || 1990;

  const sqftMin = Math.round(sqft * 0.80);
  const sqftMax = Math.round(sqft * 1.20);

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';

  if (RAPIDAPI_KEY) {
    try {
      const location = encodeURIComponent(`${city ? city+' ' : ''}TX ${zip}`);
      const url = [
        `https://unofficial-zillow-api2.p.rapidapi.com/search`,
        `?location=${location}`,
        `&status=recently_sold`,
        `&beds_min=${beds}`,
        `&beds_max=${beds+1}`,
        `&sqft_min=${sqftMin}`,
        `&sqft_max=${sqftMax}`,
        `&home_type=Houses`,
        `&days=180`,
        ...(hasPool ? ['&has_pool=true'] : []),
        ...(waterfront ? ['&is_waterfront=true'] : []),
      ].join('');

      const res = await fetch(url, {
        headers: {
          'x-rapidapi-key':  RAPIDAPI_KEY,
          'x-rapidapi-host': 'unofficial-zillow-api2.p.rapidapi.com',
        },
        next: { revalidate: 3600 },
      });

      if (res.ok) {
        const data = await res.json();
        const results = data.results || data.props || data.data || [];

        if (results.length > 0) {
          const comps = results
            .slice(0, 9)
            .map((r: any, i: number) => {
              const price   = r.price || r.soldPrice || 0;
              const living  = r.livingArea || r.sqft || sqft;
              const finalPrice = typeof price === 'string'
                ? parseInt(price.replace(/[^0-9]/g,'')) || 0
                : price;
              return {
                address:       (r.streetAddress || `${1000+i*200} Unknown St`) + ', ' + (r.city || city),
                price:         finalPrice,
                beds:          r.bedrooms || beds,
                baths:         r.bathrooms || 2,
                sqft:          living,
                yearBuilt:     r.yearBuilt || yearBuilt,
                pricePerSqft:  finalPrice && living ? Math.round(finalPrice / living) : 0,
                daysAgo:       r.daysOnZillow || 30,
                distanceMiles: parseFloat((0.2 + i * 0.18).toFixed(1)),
                source:        'Zillow',
              };
            })
            .filter((c: any) =>
              c.price > 10000 &&
              c.sqft >= sqftMin &&
              c.sqft <= sqftMax
            )
            .slice(0, 6);

          if (comps.length > 0) {
            const prices       = comps.map((c: any) => c.price).sort((a: number, b: number) => a - b);
            const trimmed      = prices.length > 4 ? prices.slice(1,-1) : prices;
            const suggestedArv = Math.round(trimmed.reduce((a: number, b: number) => a+b, 0) / trimmed.length);
            return NextResponse.json({ comps, source:'zillow_live', suggestedArv });
          }
        }
      }
    } catch (err) {
      console.error('Zillow error:', err);
    }
  }

  // ── Fallback ─────────────────────────────────────────────
  let basePrice = estimateMarketPrice(zip, sqft, beds);

  // Apply waterfront + pool premiums to fallback estimates
  if (waterfront) basePrice = Math.round(basePrice * 1.22);
  if (hasPool)    basePrice = Math.round(basePrice * 1.08);

  const streets = ['Magnolia Bend Dr','Cypress Creek Ln','Live Oak Blvd','Pecan Hollow Ct','Bluebonnet Ridge Rd','Mockingbird Ln'];
  const variants = [
    { v:-0.04, dom:18, ds:-Math.round(sqft*0.07), dy:-4 },
    { v:+0.03, dom:11, ds:+Math.round(sqft*0.04), dy:+6 },
    { v:-0.02, dom:27, ds:-Math.round(sqft*0.03), dy:-8 },
    { v:+0.05, dom:9,  ds:+Math.round(sqft*0.09), dy:+3 },
    { v:-0.07, dom:44, ds:-Math.round(sqft*0.06), dy:-11},
    { v:+0.01, dom:22, ds:+Math.round(sqft*0.03), dy:+7 },
  ];

  const comps = variants.map((x, i) => {
    const price    = Math.round(basePrice * (1 + x.v));
    const compSqft = Math.round(Math.max(sqft*0.80, Math.min(sqft*1.20, sqft+x.ds)));
    const compYear = Math.max(1950, yearBuilt + x.dy);
    return {
      address:       `${1000+i*317} ${streets[i]}, ${city||'TX'} ${zip}`,
      price,
      beds,
      baths:         beds > 3 ? 2.5 : 2,
      sqft:          compSqft,
      yearBuilt:     compYear,
      pricePerSqft:  Math.round(price / compSqft),
      daysAgo:       x.dom,
      distanceMiles: parseFloat((0.5 + i * 0.25).toFixed(1)),
      source:        'Market estimate',
    };
  });

  const prices       = comps.map(c => c.price).sort((a,b) => a-b);
  const trimmed      = prices.slice(1,-1);
  const suggestedArv = Math.round(trimmed.reduce((a,b) => a+b,0) / trimmed.length);

  return NextResponse.json({ comps, source:'market_estimate', suggestedArv });
}
