import { NextRequest, NextResponse } from 'next/server';

// ── Real-time STR data via RapidAPI Airbnb ───────────────────
// Uses same RAPIDAPI_KEY as comps
// API: Airbnb13 on RapidAPI — free tier available
// Falls back to market-calibrated estimates

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const zip     = searchParams.get('zip')   || '';
  const city    = searchParams.get('city')  || '';
  const beds    = parseInt(searchParams.get('beds')  || '3');
  const hasPool = searchParams.get('pool')  === 'true';
  const isWaterfront = searchParams.get('waterfront') === 'true';

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';

  // ── Try Airbnb API via RapidAPI ──────────────────────────
  if (RAPIDAPI_KEY) {
    try {
      const location = encodeURIComponent(`${city ? city + ', ' : ''}TX`);
      const url = `https://airbnb13.p.rapidapi.com/search-location?location=${location}&checkin=2025-08-01&checkout=2025-08-08&adults=${beds > 4 ? 8 : beds * 2}&children=0&infants=0&pets=0&page=1&currency=USD`;

      const res = await fetch(url, {
        headers: {
          'x-rapidapi-key':  RAPIDAPI_KEY,
          'x-rapidapi-host': 'airbnb13.p.rapidapi.com',
        },
        next: { revalidate: 7200 },
      });

      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];

        if (results.length >= 3) {
          // Filter by bed count
          const filtered = results
            .filter((r: any) => {
              const rBeds = r.beds || r.bedrooms || 0;
              return rBeds >= beds - 1 && rBeds <= beds + 1;
            })
            .slice(0, 10);

          if (filtered.length >= 3) {
            const rates = filtered
              .map((r: any) => r.price?.rate || r.price?.total || 0)
              .filter((p: number) => p > 20 && p < 2000);

            if (rates.length >= 3) {
              const sorted  = rates.sort((a: number, b: number) => a - b);
              const trimmed = sorted.slice(1, -1);
              const avgAdr  = Math.round(trimmed.reduce((a: number, b: number) => a + b, 0) / trimmed.length);

              // Apply premiums
              let finalAdr = avgAdr;
              if (hasPool)       finalAdr = Math.round(finalAdr * 1.18);
              if (isWaterfront)  finalAdr = Math.round(finalAdr * 1.25);

              const occupancy    = city?.toLowerCase().includes('austin') ? 0.72 : 0.68;
              const annualRevenue = Math.round(finalAdr * 365 * occupancy);

              return NextResponse.json({
                adr:           finalAdr,
                occupancy,
                annualRevenue,
                monthlyRevenue: Math.round(annualRevenue / 12),
                source:        'airbnb_live',
                sampleSize:    rates.length,
                premiums:      { pool: hasPool, waterfront: isWaterfront },
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Airbnb API error:', err);
    }
  }

  // ── Fallback: Market-calibrated STR estimates ─────────────
  // Based on AirDNA market reports Q1 2025 for TX cities

  const marketAdrs: Record<string, number> = {
    'austin':      195,
    'dallas':      165,
    'houston':     142,
    'san antonio': 138,
    'fort worth':  128,
    'kemah':       168,  // Tourism market — Kemah Boardwalk
    'galveston':   185,  // Beach market premium
    'fredericksburg': 245, // Wine country — highest TX STR market
    'new braunfels':  195,
    'corpus christi': 155,
    'south padre':    210,
  };

  const cityLower = (city || '').toLowerCase();
  let baseAdr = 130; // TX general fallback

  for (const [market, adr] of Object.entries(marketAdrs)) {
    if (cityLower.includes(market)) {
      baseAdr = adr;
      break;
    }
  }

  // Zip-based fallback
  if (baseAdr === 130) {
    if (zip.startsWith('787') || zip.startsWith('786')) baseAdr = 195;
    else if (zip.startsWith('770') || zip.startsWith('771')) baseAdr = 142;
    else if (zip.startsWith('750') || zip.startsWith('751')) baseAdr = 165;
    else if (zip.startsWith('775')) baseAdr = 168; // Kemah/Clear Lake zip
    else if (zip.startsWith('782') || zip.startsWith('783')) baseAdr = 138;
  }

  // Bedroom size adjustment
  const bedMult =
    beds <= 1 ? 0.65 :
    beds === 2 ? 0.82 :
    beds === 3 ? 1.00 :
    beds === 4 ? 1.22 :
    beds === 5 ? 1.42 :
    beds >= 6  ? 1.65 : 1.00;

  let finalAdr = Math.round(baseAdr * bedMult);
  if (hasPool)      finalAdr = Math.round(finalAdr * 1.18);
  if (isWaterfront) finalAdr = Math.round(finalAdr * 1.25);

  const occupancy     = cityLower.includes('austin') ? 0.72 : 0.68;
  const annualRevenue = Math.round(finalAdr * 365 * occupancy);

  return NextResponse.json({
    adr:           finalAdr,
    occupancy,
    annualRevenue,
    monthlyRevenue: Math.round(annualRevenue / 12),
    source:        'market_estimate',
    sampleSize:    0,
    premiums:      { pool: hasPool, waterfront: isWaterfront },
  });
}
