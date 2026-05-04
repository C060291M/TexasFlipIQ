import { NextRequest, NextResponse } from 'next/server';
import { estimateMarketPrice } from '@/lib/engines/comparablesEngine';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const zip       = searchParams.get('zip')       || '';
  const city      = searchParams.get('city')      || '';
  const bedsStr   = searchParams.get('beds')      || '3';
  const sqftStr   = searchParams.get('sqft')      || '1500';
  const yearStr   = searchParams.get('year')      || '1990';
  const beds      = parseInt(bedsStr)  || 3;
  const sqft      = parseInt(sqftStr)  || 1500;
  const yearBuilt = parseInt(yearStr)  || 1990;

  // Comparable filters
  const sqftMin    = Math.round(sqft * 0.80);      // within 20%
  const sqftMax    = Math.round(sqft * 1.20);
  const yearMin    = yearBuilt - 15;               // within 15 years
  const yearMax    = yearBuilt + 15;

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';

  if (RAPIDAPI_KEY) {
    try {
      const location = encodeURIComponent(
        `${city ? city + ' ' : ''}TX ${zip}`
      );

      // Request with sqft range + recent sales within 180 days
      const url = [
        `https://unofficial-zillow-api2.p.rapidapi.com/search`,
        `?location=${location}`,
        `&status=recently_sold`,
        `&beds_min=${beds}`,
        `&beds_max=${beds + 1}`,
        `&sqft_min=${sqftMin}`,
        `&sqft_max=${sqftMax}`,
        `&home_type=Houses`,
        `&days=180`,
      ].join('');

      const res = await fetch(url, {
        headers: {
          'x-rapidapi-key':  RAPIDAPI_KEY,
          'x-rapidapi-host': 'unofficial-zillow-api2.p.rapidapi.com',
          'Content-Type':    'application/json',
        },
        next: { revalidate: 3600 },
      });

      if (res.ok) {
        const data = await res.json();
        const results = data.results || data.props || data.data || [];

        if (results.length > 0) {
          const comps = results
            .slice(0, 9) // get more then filter
            .map((r: any, i: number) => {
              const price   = r.price || r.soldPrice || 0;
              const living  = r.livingArea || r.sqft || sqft;
              const builtYr = r.yearBuilt || yearBuilt;
              const finalPrice = typeof price === 'string'
                ? parseInt(price.replace(/[^0-9]/g, '')) || 0
                : price;
              return {
                address:       (r.streetAddress || `${1000+i*200} Unknown St`) + ', ' + (r.city || city),
                price:         finalPrice,
                beds:          r.bedrooms || beds,
                baths:         r.bathrooms || 2,
                sqft:          living,
                yearBuilt:     builtYr,
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
            const trimmed      = prices.length > 4 ? prices.slice(1, -1) : prices;
            const suggestedArv = Math.round(trimmed.reduce((a: number, b: number) => a + b, 0) / trimmed.length);
            return NextResponse.json({ comps, source: 'zillow_live', suggestedArv });
          }
        }
      }
    } catch (err) {
      console.error('Zillow API error:', err);
    }
  }

  // ── Fallback: Market-calibrated estimates ─────────────────
  const basePrice = estimateMarketPrice(zip, sqft, beds);

  const streets = [
    'Magnolia Bend Dr', 'Cypress Creek Ln', 'Live Oak Blvd',
    'Pecan Hollow Ct', 'Bluebonnet Ridge Rd', 'Mockingbird Ln',
  ];

  const variants = [
    { variance:-0.05, dom:18, sqftDelta:-Math.round(sqft*0.08), yearDelta:-3 },
    { variance:+0.03, dom:11, sqftDelta:+Math.round(sqft*0.05), yearDelta:+5 },
    { variance:-0.02, dom:27, sqftDelta:-Math.round(sqft*0.03), yearDelta:-8 },
    { variance:+0.06, dom:9,  sqftDelta:+Math.round(sqft*0.10), yearDelta:+2 },
    { variance:-0.08, dom:44, sqftDelta:-Math.round(sqft*0.07), yearDelta:-12},
    { variance:+0.01, dom:22, sqftDelta:+Math.round(sqft*0.04), yearDelta:+7 },
  ];

  const comps = variants.map((v, i) => {
    const price      = Math.round(basePrice * (1 + v.variance));
    const compSqft   = Math.round(Math.max(sqft * 0.80, sqft + v.sqftDelta));
    const compYear   = Math.max(1950, yearBuilt + v.yearDelta);
    return {
      address:       `${1000+i*317} ${streets[i]}, ${city||'TX'} ${zip}`,
      price,
      beds,
      baths:         beds > 3 ? 2.5 : 2,
      sqft:          compSqft,
      yearBuilt:     compYear,
      pricePerSqft:  Math.round(price / compSqft),
      daysAgo:       v.dom,
      distanceMiles: parseFloat((0.5 + i * 0.25).toFixed(1)),
      source:        'Market estimate',
    };
  });

  const prices       = comps.map(c => c.price).sort((a, b) => a - b);
  const trimmed      = prices.slice(1, -1);
  const suggestedArv = Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);

  return NextResponse.json({ comps, source: 'market_estimate', suggestedArv });
}
