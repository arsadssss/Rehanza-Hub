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
      sql`SELECT * FROM platform_performance`,
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
    
    return NextResponse.json({
        summary: summaryRes[0] || {},
        platformPerformance: platformRes,
        ordersReturnsData: ordersReturnsRes,
        bestSeller: bestSellerRes[0] || {},
        lowStock: lowStockRes[0] || {},
        recentOrders: recentOrdersRes,
        topSellingProducts: topSellingRes,
        vendors: vendorsRes,
        vendorPurchases: vendorPurchasesRes,
        allOrders: allOrdersRes,
        vendorPayments: vendorPaymentsRes,
    });

  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json(
      { message: "Failed to fetch dashboard data", error: error.message },
      { status: 500 }
    );
  }
}
