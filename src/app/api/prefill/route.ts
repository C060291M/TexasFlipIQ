import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const prefillData = {
      address:       body.address        || '',
      city:          body.city           || '',
      state:         body.state          || 'TX',
      zipCode:       body.zip_code       || '',
      sqft:          body.sqft           || null,
      bedrooms:      body.bedrooms       || null,
      bathrooms:     body.bathrooms      || null,
      yearBuilt:     body.year_built     || null,
      purchasePrice: body.purchase_price || null,
      arv:           body.arv            || null,
      rehabCost:     body.rehab_cost     || null,
      condition:     body.condition      || 'moderate',
      indicators:    body.indicators     || [],
      riskScore:     body.risk_score     || null,
      riskLabel:     body.risk_label     || null,
      source:        'underwriteiq',
    }

    return NextResponse.json({ 
      success: true, 
      data: prefillData,
      message: 'Property data received from UnderwriteIQ'
    })

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid data received' },
      { status: 400 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const prefillData = {
    address:       searchParams.get('address')        || '',
    city:          searchParams.get('city')            || '',
    state:         searchParams.get('state')           || 'TX',
    zipCode:       searchParams.get('zip_code')        || '',
    sqft:          searchParams.get('sqft')            ? Number(searchParams.get('sqft')) : null,
    bedrooms:      searchParams.get('bedrooms')        ? Number(searchParams.get('bedrooms')) : null,
    bathrooms:     searchParams.get('bathrooms')       ? Number(searchParams.get('bathrooms')) : null,
    yearBuilt:     searchParams.get('year_built')      ? Number(searchParams.get('year_built')) : null,
    purchasePrice: searchParams.get('purchase_price')  ? Number(searchParams.get('purchase_price')) : null,
    arv:           searchParams.get('arv')             ? Number(searchParams.get('arv')) : null,
    rehabCost:     searchParams.get('rehab_cost')      ? Number(searchParams.get('rehab_cost')) : null,
    condition:     searchParams.get('condition')       || 'moderate',
    source:        'underwriteiq',
  }

  return NextResponse.json({ 
    success: true, 
    data: prefillData 
  })
}