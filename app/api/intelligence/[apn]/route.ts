import { NextRequest, NextResponse } from 'next/server';
import { generateIntelligencePackage, normalizeAPN } from '@/services/intelligencePackage';

const APN_PATTERN = /^\d{3,4}-?\d{3}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: { apn: string } }
) {
  const { apn } = params;

  if (!apn) {
    return NextResponse.json(
      { error: 'Missing APN parameter' },
      { status: 400 }
    );
  }

  const normalized = normalizeAPN(apn);

  if (!APN_PATTERN.test(apn) && !APN_PATTERN.test(normalized)) {
    return NextResponse.json(
      { error: 'Invalid APN format. Expected 7-digit number with optional hyphen (e.g. 0263011 or 0263-011)' },
      { status: 400 }
    );
  }

  try {
    const pkg = await generateIntelligencePackage(normalized);
    return NextResponse.json(pkg);
  } catch (err) {
    console.error(`[intelligence/${apn}] Generation failed:`, err);
    return NextResponse.json(
      { error: 'Failed to generate intelligence package', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
