import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import { subDays, format } from 'date-fns';

export const revalidate = 0;

export async function GET() {
  try {
    const sixDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');

    const [
      salesRes,
      returnsSummaryRes,
      allOrdersRes,
      ordersWithMarginRes,
      returnsWithMarginRes,
      salesLast7DaysRes,
    ] = await Promise.all([
      // Total Sales (Last 7 days)
      sql`SELECT total_amount FROM orders WHERE is_deleted = false AND order_date >= ${sixDaysAgo}`,
      
      // Returns Summary (Last 7 days) - Aggregated manually to avoid missing view
      sql`
        SELECT 
          DATE(return_date) as return_date, 
          SUM(quantity)::int as total_returns,
          SUM(total_loss)::numeric as total_loss
        FROM returns 
        WHERE is_deleted = false AND return_date >= ${sixDaysAgo}
        GROUP BY DATE(return_date)
        ORDER BY return_date ASC
      `,
      
      // Platform Distribution
      sql`SELECT platform FROM orders WHERE is_deleted = false`,
      
      // Data for Profit Calculation
      sql`
        SELECT o.quantity, p.margin
        FROM orders o
        JOIN product_variants pv ON o.variant_id = pv.id
        JOIN allproducts p ON pv.product_id = p.id
        WHERE o.is_deleted = false
      `,
      
      // Data for Return impact
      sql`
        SELECT r.quantity, r.restockable, p.margin
        FROM returns r
        JOIN product_variants pv ON r.variant_id = pv.id
        JOIN allproducts p ON pv.product_id = p.id
        WHERE r.is_deleted = false
      `,
      
      // Sales Trend (Last 7 days) - Aggregated manually to avoid missing view
      sql`
        SELECT 
          DATE(order_date) as label, 
          SUM(total_amount)::numeric as total_sales,
          COUNT(id)::int as total_orders
        FROM orders 
        WHERE is_deleted = false AND order_date >= ${sixDaysAgo}
        GROUP BY DATE(order_date)
        ORDER BY label ASC
      `,
    ]);

    // Format results to ensure numeric types
    const totalSales = (salesRes || []).reduce((acc: number, order: any) => acc + Number(order.total_amount || 0), 0);
    
    const meesho = (allOrdersRes || []).filter((o: any) => o.platform === "Meesho").length;
    const flipkart = (allOrdersRes || []).filter((o: any) => o.platform === "Flipkart").length;
    const amazon = (allOrdersRes || []).filter((o: any) => o.platform === "Amazon").length;
    
    const platformOrders = [
        { name: 'Meesho', value: meesho },
        { name: 'Flipkart', value: flipkart },
        { name: 'Amazon', value: amazon },
    ].filter(p => p.value > 0);

    const totalPlatformOrders = meesho + flipkart + amazon;

    const grossMargin = (ordersWithMarginRes || []).reduce((acc: number, order: any) => {
        return acc + (Number(order.quantity || 0) * Number(order.margin || 0));
    }, 0);

    const returnImpact = (returnsWithMarginRes || []).reduce((acc: number, ret: any) => {
        if (ret.restockable) {
            return acc + (Number(ret.quantity || 0) * 45); // Fixed loss for restockable
        }
        return acc + (Number(ret.quantity || 0) * Number(ret.margin || 0)); // Loss of margin for non-restockable
    }, 0);

    const netProfit = grossMargin - returnImpact;

    return NextResponse.json({
        success: true,
        totalSales,
        returnsData: (returnsSummaryRes || []).map((r: any) => ({
            ...r,
            total_returns: Number(r.total_returns),
            total_loss: Number(r.total_loss)
        })),
        platformOrders,
        totalPlatformOrders,
        netProfit,
        salesData: (salesLast7DaysRes || []).map((s: any) => ({
            ...s,
            label: format(new Date(s.label), 'yyyy-MM-dd'),
            total_sales: Number(s.total_sales),
            total_orders: Number(s.total_orders)
        })),
    });

  } catch (error: any) {
    console.error("Analytics API Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch analytics data", error: error.message }, { status: 500 });
  }
}
