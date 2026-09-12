import { NextRequest, NextResponse } from 'next/server';
import {
  generateAiGroupingSuggestions,
  getPendingAiSuggestions,
  resolveAiSuggestion,
} from '@/lib/products/sku-registry-service';

export const revalidate = 0;

/**
 * GET /api/products/suggestions
 * Returns all pending AI grouping suggestions for the active account.
 */
export async function GET(request: NextRequest) {
  const accountId = request.headers.get('x-account-id');
  if (!accountId) {
    return NextResponse.json({ success: false, message: 'Account context missing' }, { status: 400 });
  }

  try {
    const suggestions = await getPendingAiSuggestions(accountId);
    return NextResponse.json({ success: true, data: suggestions });
  } catch (error: any) {
    console.error('API Products Suggestions GET Error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to fetch suggestions' }, { status: 500 });
  }
}

/**
 * POST /api/products/suggestions
 * Actions:
 * 1. Generate suggestions: { action: 'generate' }
 * 2. Resolve suggestion: { action: 'resolve', suggestionId: string, decision: 'approve' | 'reject' }
 */
export async function POST(request: NextRequest) {
  const accountId = request.headers.get('x-account-id');
  if (!accountId) {
    return NextResponse.json({ success: false, message: 'Account context missing' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'generate') {
      const result = await generateAiGroupingSuggestions(accountId);
      return NextResponse.json({
        success: true,
        message: `Generated ${result.generated} suggestions (${result.evaluated} SKUs evaluated)`,
        ...result,
      });
    }

    if (action === 'resolve') {
      const { suggestionId, decision, userEmail } = body;
      if (!suggestionId || !['approve', 'reject'].includes(decision)) {
        return NextResponse.json(
          { success: false, message: 'Valid suggestionId and decision (approve/reject) are required' },
          { status: 400 }
        );
      }

      const result = await resolveAiSuggestion(accountId, suggestionId, decision, userEmail);
      return NextResponse.json({
        success: true,
        message: `Suggestion ${decision}d successfully`,
        ...result,
      });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('API Products Suggestions POST Error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to process suggestion' }, { status: 500 });
  }
}

