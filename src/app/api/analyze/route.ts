import { NextRequest, NextResponse } from 'next/server';
import { calculateRehab } from '@/lib/engines/rehabEngine';
import { calculateDeal, sensitivityAnalysis } from '@/lib/engines/dealCalculator';
import { analyzeRisks } from '@/lib/engines/riskAnalyzer';
import { generateComps } from '@/lib/engines/comparablesEngine';
import { generateRecommendations } from '@/lib/engines/roiOptimizer';
import type { PropertyInput } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = body.property as PropertyInput;
    if (!input) return NextResponse.json({ success:false, errors:['property field required'] }, { status:400 });

    const rehab = calculateRehab(input);
    const deal  = calculateDeal(input, rehab);
    const risks = analyzeRisks(input, rehab, deal);
    const comps = generateComps(input);
    const recommendations = generateRecommendations(input, rehab, deal, comps);
    const sensitivity = sensitivityAnalysis(input, rehab);

    return NextResponse.json({ success:true, data:{ property:input, rehab, deal, risks, comps, recommendations, sensitivity, analyzedAt:new Date().toISOString() } });
  } catch (err) {
    return NextResponse.json({ success:false, errors:['Internal server error'] }, { status:500 });
  }
}

export async function GET() {
  return NextResponse.json({ service:'TexasFlipIQ', version:'1.0.0', status:'operational' });
}
