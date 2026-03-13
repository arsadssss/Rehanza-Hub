import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: "Endpoint deprecated. Use /api/orders/import/flipkart" });
}
