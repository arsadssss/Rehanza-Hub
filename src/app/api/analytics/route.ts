
import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { subDays, format } from 'date-fns';

export const revalidate = 0;

export async function GET() {
  try {
    const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    const sixDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');

    const [
      salesRes,
      returnsSummaryRes,
      allOrdersRes,
      ordersWithMarginRes,
      returnsWithMarginRes,
      salesLast7DaysRes,
    ] = await Promise.all([
      sql`SELECT total_amount FROM orders WHERE is_deleted = false AND created_at >= ${sevenDaysAgo}`,
      sql`SELECT * FROM returns_summary WHERE return_date >= ${sixDaysAgo}`,
      sql`SELECT platform FROM orders WHERE is_deleted = false`,
      sql`
        SELECT o.quantity, p.margin
        FROM orders o
        JOIN product_variants pv ON o.variant_id = pv.id
        JOIN allproducts p ON pv.product_id = p.id
        WHERE o.is_deleted = false
      `,
      sql`
        SELECT r.quantity, r.restockable, p.margin
        FROM returns r
        JOIN product_variants pv ON r.variant_id = pv.id
        JOIN allproducts p ON pv.product_id = p.id
        WHERE r.is_deleted = false
      `,
      sql`SELECT * FROM analytics_last_7_days ORDER BY label`,
    ]);

    // Total Sales
    const totalSales = salesRes.reduce((acc: number, order: any) => acc + Number(order.total_amount || 0), 0);
    
    // Platform Orders
    const meesho = allOrdersRes.filter((o: any) => o.platform === "Meesho").length;
    const flipkart = allOrdersRes.filter((o: any) => o.platform === "Flipkart").length;
    const amazon = allOrdersRes.filter((o: any) => o.platform === "Amazon").length;
    const platformOrders = [
        { name: 'Meesho', value: meesho },
        { name: 'Flipkart', value: flipkart },
        { name: 'Amazon', value: amazon },
    ].filter(p => p.value > 0);
    const totalPlatformOrders = meesho + flipkart + amazon;

    // Net Profit
    const grossMargin = ordersWithMarginRes.reduce((acc: number, order: any) => {
        const margin = Number(order.margin || 0);
        return acc + (Number(order.quantity) * margin);
    }, 0);

    const returnImpact = returnsWithMarginRes.reduce((acc: number, ret: any) => {
        if (ret.restockable) {
            return acc + (Number(ret.quantity) * 45); // Fixed loss for restockable
        }
        const margin = Number(ret.margin || 0);
        return acc + (Number(ret.quantity) * margin); // Loss of margin for non-restockable
    }, 0);
    const netProfit = grossMargin - returnImpact;


    return NextResponse.json({
        totalSales,
        returnsData: returnsSummaryRes,
        platformOrders,
        totalPlatformOrders,
        netProfit,
        salesData: salesLast7DaysRes,
    });

  } catch (error: any) {
    console.error("Analytics API Error:", error);
    return NextResponse.json({ message: "Failed to fetch analytics data", error: error.message }, { status: 500 });
  }
}
