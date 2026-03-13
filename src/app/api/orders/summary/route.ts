
import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json({ success: true, data: { totalOrders: 0, totalRevenue: 0, todayOrders: 0, todayRevenue: 0 } });
}
