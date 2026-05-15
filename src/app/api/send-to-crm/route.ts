import { NextRequest, NextResponse } from 'next/server'

let lastDealData: any = null

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    lastDealData = {
      address:      body.address      || '',
      city:         body.city         || '',
      state:        body.state        || 'TX',
      zipCode:      body.zipCode      || '',
      arv:          body.arv          || 0,
      rehabCost:    body.rehabCost    || 0,
      offerPrice:   body.offerPrice   || 0,
      flipProfit:   body.flipProfit   || 0,
      roi:          body.roi          || 0,
      dealScore:    body.dealScore    || 0,
      dealGrade:    body.dealGrade    || '',
      condition:    body.condition    || 'moderate',
      exitStrategy: body.exitStrategy || 'Fix & Flip',
      timestamp:    new Date().toISOString(),
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Deal data received by UnderwriteIQ CRM',
      data: lastDealData
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid data' },
      { status: 400 }
    )
  }
}

export async function GET() {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (!lastDealData) {
    return NextResponse.json({ success: false, message: 'No deal data available yet' }, { headers })
  }
  return NextResponse.json({ success: true, data: lastDealData }, { headers })
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }})
}