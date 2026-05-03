import { NextRequest, NextResponse } from 'next/server';
import { estimateMarketPrice } from '@/lib/engines/comparablesEngine';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const zip     = searchParams.get('zip')     || '';
  const city    = searchParams.get('city')    || '';
  const bedsStr = searchParams.get('beds')    || '3';
  const sqftStr = searchParams.get('sqft')    || '1500';
  const beds    = parseInt(bedsStr) || 3;
  const sqft    = parseInt(sqftStr) || 1500;

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';

  // ── Unofficial Zillow API (free 250 calls/month) ──────────
  if (RAPIDAPI_KEY) {
    try {
      const location = encodeURIComponent(
        `${city ? city + ' ' : ''}TX ${zip}`
      );

      const url = `https://unofficial-zillow-api2.p.rapidapi.com/search?location=${location}&status=recently_sold&beds_min=${beds}&home_type=Houses&days=90`;

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
            .slice(0, 6)
            .map((r: any, i: number) => {
              const price  = r.price || r.soldPrice || r.unformattedPrice || 0;
              const living = r.livingArea || r.sqft || r.area || sqft;
              return {
                address:       (r.streetAddress || r.address || `${1000+i*200} Unknown St`) +
                               ', ' + (r.city || city || 'TX'),
                price:         typeof price === 'string'
                               ? parseInt(price.replace(/[^0-9]/g,'')) || 0
                               : price,
                beds:          r.bedrooms || r.beds || beds,
                baths:         r.bathrooms || r.baths || 2,
                sqft:          living,
                pricePerSqft:  price && living ? Math.round(price / living) : 0,
                daysAgo:       r.daysOnZillow || r.daysListed || 30,
                distanceMiles: parseFloat((0.2 + i * 0.18).toFixed(1)),
                source:        'Zillow',
              };
            })
            .filter((c: any) => c.price > 10000);

          if (comps.length > 0) {
            return NextResponse.json({ comps, source: 'zillow_live' });
          }
        }
      }
    } catch (err) {
      console.error('Unofficial Zillow API error:', err);
    }
  }

  // ── Fallback: Market-calibrated estimates ─────────────────
  const basePrice = estimateMarketPrice(zip, sqft, beds);

  const streets = [
    'Magnolia Bend Dr', 'Cypress Creek Ln', 'Live Oak Blvd',
    'Pecan Hollow Ct',  'Bluebonnet Ridge Rd', 'Mockingbird Ln',
  ];

  const variants = [
    { variance:-0.05, dom:18, sqftDelta:-120 },
    { variance:+0.03, dom:11, sqftDelta:+80  },
    { variance:-0.02, dom:27, sqftDelta:-50  },
    { variance:+0.06, dom:9,  sqftDelta:+200 },
    { variance:-0.08, dom:44, sqftDelta:-180 },
    { variance:+0.01, dom:22, sqftDelta:+60  },
  ];

  const comps = variants.map((v, i) => {
    const price    = Math.round(basePrice * (1 + v.variance));
    const compSqft = Math.max(800, sqft + v.sqftDelta);
    return {
      address:       `${1000+i*317} ${streets[i]}, ${city||'TX'} ${zip}`,
      price,
      beds,
      baths:         beds > 3 ? 2.5 : 2,
      sqft:          compSqft,
      pricePerSqft:  Math.round(price / compSqft),
      daysAgo:       v.dom,
      distanceMiles: parseFloat((0.2 + i * 0.18).toFixed(1)),
      source:        'Market estimate',
    };
  });

  return NextResponse.json({
    comps,
    source:  'market_estimate',
    message: 'Market-calibrated estimates based on TX zip data.',
  });
}
