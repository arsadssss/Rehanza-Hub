import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  try {
    const [
      summaryRes,
      platformRes,
      ordersReturnsRes,
      bestSellerRes,
      lowStockRes,
      recentOrdersRes,
      topSellingRes,
      vendorsRes,
      vendorPurchasesRes,
      vendorPaymentsRes,
      allOrdersRes,
    ] = await Promise.all([
      sql`SELECT * FROM dashboard_summary LIMIT 1`,
      sql`
        SELECT 
          platform,
          COALESCE(SUM(quantity), 0) as total_units,
          COALESCE(SUM(total_amount), 0) as total_revenue
        FROM orders
        WHERE is_deleted = false
        GROUP BY platform
      `,
      sql`SELECT * FROM weekly_orders_vs_returns`,
      sql`SELECT * FROM best_selling_sku LIMIT 1`,
      sql`SELECT * FROM low_stock_items LIMIT 1`,
      sql`
        SELECT o.id, o.created_at, o.platform, o.quantity, o.total_amount, pv.variant_sku
        FROM orders o
        LEFT JOIN product_variants pv ON o.variant_id = pv.id
        WHERE o.is_deleted = false
        ORDER BY o.created_at DESC 
        LIMIT 5
      `,
      sql`SELECT * FROM top_selling_products LIMIT 5`,
      sql`SELECT id, vendor_name FROM vendors`,
      sql`SELECT vendor_id, quantity, cost_per_unit FROM vendor_purchases WHERE is_deleted = false`,
      sql`SELECT vendor_id, amount FROM vendor_payments WHERE is_deleted = false`,
      sql`SELECT platform, quantity, selling_price FROM orders WHERE is_deleted = false`,
    ]);

    // Ensure numeric parsing for all database results
    const summary = summaryRes[0] ? {
        total_units: Number(summaryRes[0].total_units || 0),
        gross_revenue: Number(summaryRes[0].gross_revenue || 0),
        net_profit: Number(summaryRes[0].net_profit || 0),
        return_rate: Number(summaryRes[0].return_rate || 0),
    } : { total_units: 0, gross_revenue: 0, net_profit: 0, return_rate: 0 };

    const platformPerformance = platformRes.map((p: any) => ({
        platform: p.platform,
        total_units: Number(p.total_units || 0),
        total_revenue: Number(p.total_revenue || 0),
    }));

    const ordersReturnsData = ordersReturnsRes.map((d: any) => ({
        day_label: d.day_label,
        total_orders: Number(d.total_orders || 0),
        total_returns: Number(d.total_returns || 0),
    }));

    const topSellingProducts = topSellingRes.map((p: any) => ({
        product_name: p.product_name,
        variant_sku: p.variant_sku,
        total_revenue: Number(p.total_revenue || 0),
        total_units_sold: Number(p.total_units_sold || 0),
    }));

    const recentOrders = recentOrdersRes.map((o: any) => ({
        ...o,
        quantity: Number(o.quantity || 0),
        total_amount: Number(o.total_amount || 0),
    }));

    const responseData = {
        summary,
        platformPerformance,
        ordersReturnsData,
        bestSeller: bestSellerRes[0] || {},
        lowStock: lowStockRes[0] || {},
        recentOrders,
        topSellingProducts,
        vendors: vendorsRes,
        vendorPurchases: vendorPurchasesRes.map((p: any) => ({ ...p, quantity: Number(p.quantity), cost_per_unit: Number(p.cost_per_unit) })),
        allOrders: allOrdersRes.map((o: any) => ({ ...o, quantity: Number(o.quantity), selling_price: Number(o.selling_price) })),
        vendorPayments: vendorPaymentsRes.map((p: any) => ({ ...p, amount: Number(p.amount) })),
    };

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json(
      { message: "Failed to fetch dashboard data", error: error.message },
      { status: 500 }
    );
  }
}
