import { NextRequest, NextResponse } from 'next/server';
import { estimateMarketPrice } from '@/lib/engines/comparablesEngine';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const zip     = searchParams.get('zip')     || '';
  const city    = searchParams.get('city')    || '';
  const bedsStr = searchParams.get('beds')    || '3';
  const sqftStr = searchParams.get('sqft')    || '1500';
  const address = searchParams.get('address') || '';
  const beds    = parseInt(bedsStr)  || 3;
  const sqft    = parseInt(sqftStr)  || 1500;

  // ── Try RapidAPI Zillow (free tier — 50 calls/month) ─────
  // Sign up FREE at rapidapi.com → search "Zillow56" → subscribe to free plan
  // Then add RAPIDAPI_KEY to your .env.local file
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';

  if (RAPIDAPI_KEY) {
    try {
      const location = encodeURIComponent(`${city ? city + ' ' : ''}TX ${zip}`);
      const url = `https://zillow56.p.rapidapi.com/search?location=${location}&status=sold&beds_min=${beds}&days=90&home_type=Houses`;
      const res = await fetch(url, {
        headers: {
          'X-RapidAPI-Key':  RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'zillow56.p.rapidapi.com',
        },
        next: { revalidate: 3600 }, // Cache 1 hour
      });

      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];
        if (results.length > 0) {
          const comps = results.slice(0, 6).map((r: any, i: number) => ({
            address:       (r.streetAddress || `${1000+i*200} Unknown St`) + ', ' + (r.city || city || 'TX'),
            price:         r.price         || 0,
            beds:          r.bedrooms      || beds,
            baths:         r.bathrooms     || 2,
            sqft:          r.livingArea    || sqft,
            pricePerSqft:  r.price && r.livingArea ? Math.round(r.price / r.livingArea) : 0,
            daysAgo:       r.daysOnZillow  || 30,
            distanceMiles: parseFloat((0.2 + i * 0.18).toFixed(1)),
            source:        'Zillow',
          })).filter((c: any) => c.price > 0);

          if (comps.length > 0) {
            return NextResponse.json({ comps, source: 'zillow_live' });
          }
        }
      }
    } catch (err) {
      console.error('RapidAPI Zillow error:', err);
    }
  }

  // ── Try ATTOM free tier (100 calls/month) ────────────────
  // Sign up FREE at api.attomdata.com — no credit card needed
  // Add ATTOM_API_KEY to .env.local
  const ATTOM_KEY = process.env.ATTOM_API_KEY || '';

  if (ATTOM_KEY) {
    try {
      const res = await fetch(
        `https://api.gateway.attomdata.com/propertyapi/v1.0.0/saleshistory/snapshot?postalcode=${zip}&pagesize=6&propertytype=SFR`,
        {
          headers: { apikey: ATTOM_KEY, Accept: 'application/json' },
          next: { revalidate: 3600 },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const props = data.property || [];
        if (props.length > 0) {
          const comps = props.map((r: any, i: number) => {
            const price    = r.sale?.saleAmountData?.saleAmt || 0;
            const livingSqft = r.building?.size?.livingSize || sqft;
            return {
              address:       (r.address?.line1 || `${1000+i*200} Unknown St`) + ', ' + (r.address?.cityName || city),
              price,
              beds:          r.building?.rooms?.bedroomsCount || beds,
              baths:         r.building?.rooms?.bathsTotal    || 2,
              sqft:          livingSqft,
              pricePerSqft:  price && livingSqft ? Math.round(price / livingSqft) : 0,
              daysAgo:       30,
              distanceMiles: parseFloat((0.2 + i * 0.18).toFixed(1)),
              source:        'ATTOM',
            };
          }).filter((c: any) => c.price > 0);

          if (comps.length > 0) {
            return NextResponse.json({ comps, source: 'attom_live' });
          }
        }
      }
    } catch (err) {
      console.error('ATTOM error:', err);
    }
  }

  // ── Fallback: Market-calibrated estimates ─────────────────
  // Uses zip-code market data — realistic Texas pricing
  // Shown when no API key is configured

  const basePrice = estimateMarketPrice(zip, sqft, beds);

  const streets = [
    'Magnolia Bend Dr', 'Cypress Creek Ln', 'Live Oak Blvd',
    'Pecan Hollow Ct', 'Bluebonnet Ridge Rd', 'Mockingbird Ln',
  ];

  const variants = [
    { variance: -0.05, dom: 18, sqftDelta: -120 },
    { variance: +0.03, dom: 11, sqftDelta: +80  },
    { variance: -0.02, dom: 27, sqftDelta: -50  },
    { variance: +0.06, dom: 9,  sqftDelta: +200 },
    { variance: -0.08, dom: 44, sqftDelta: -180 },
    { variance: +0.01, dom: 22, sqftDelta: +60  },
  ];

  const comps = variants.map((v, i) => {
    const price    = Math.round(basePrice * (1 + v.variance));
    const compSqft = Math.max(800, sqft + v.sqftDelta);
    return {
      address:       `${1000 + i * 317} ${streets[i]}, ${city || 'TX'} ${zip}`,
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
    message: 'Market-calibrated estimates. Add RAPIDAPI_KEY or ATTOM_API_KEY to .env.local for live data.',
  });
}
