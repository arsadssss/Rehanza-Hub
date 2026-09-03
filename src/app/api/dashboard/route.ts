import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const accountId = request.headers.get("x-account-id");
    if (!accountId) {
      return NextResponse.json({ success: false, message: "Account not selected" }, { status: 400 });
    }

    // Parallel execution of all required dashboard datasets
    const [
      orderSummary,
      returnSummary,
      productCosts,
      topSellingRes,
      payoutRes,
      inventoryRes,
      taskProgressRes,
      trackRecordRes,
      expenseRes
    ] = await Promise.all([
      // Total Units and Gross Revenue
      sql`
        SELECT 
          COUNT(id)::int as total_orders,
          COALESCE(SUM(quantity), 0)::int as total_units,
          COALESCE(SUM(total_amount), 0)::numeric as gross_revenue
        FROM orders 
        WHERE account_id = ${accountId} AND is_deleted = false
      `,
      // Total Return Units and Total Return Loss
      sql`
        SELECT 
          COALESCE(SUM(quantity), 0)::int as return_units,
          COALESCE(SUM(total_loss), 0)::numeric as return_loss
        FROM returns 
        WHERE account_id = ${accountId} AND is_deleted = false
      `,
      // Total Cost of Goods Sold (for Net Profit)
      sql`
        SELECT COALESCE(SUM(o.quantity * p.cost_price), 0)::numeric as total_cost
        FROM orders o
        JOIN product_variants pv ON o.variant_id = pv.id
        JOIN allproducts p ON pv.product_id = p.id
        WHERE o.account_id = ${accountId} AND o.is_deleted = false
      `,
      // Top Selling Products - Top 7
      sql`
        SELECT 
          p.product_name,
          pv.variant_sku,
          SUM(o.total_amount)::numeric as total_revenue,
          SUM(o.quantity)::int as total_units_sold
        FROM orders o
        JOIN product_variants pv ON o.variant_id = pv.id
        JOIN allproducts p ON pv.product_id = p.id
        WHERE o.account_id = ${accountId} AND o.is_deleted = false
        GROUP BY p.product_name, pv.variant_sku
        ORDER BY total_units_sold DESC
        LIMIT 7
      `,
      // Total Payment Received from platform settlements
      sql`
        SELECT COALESCE(SUM(amount), 0)::numeric as total
        FROM platform_payouts
        WHERE account_id = ${accountId} AND is_deleted = false
      `,
      // Total Inventory Value from vendor purchases
      sql`
        SELECT COALESCE(SUM(quantity * cost_per_unit), 0)::numeric as total
        FROM vendor_purchases
        WHERE account_id = ${accountId} AND is_deleted = false
      `,
      // Task progress counts for Fashion workflow
      sql`
        SELECT status, task_group
        FROM tasks
        WHERE is_deleted = false AND task_group = 'Fashion'
      `,
      // Team Performance Track Record
      sql`
        SELECT 
          u.name AS user_name,
          t.created_by,
          COUNT(t.id)::int AS total_tasks,
          COUNT(t.id) FILTER (WHERE t.status = 'Pending')::int AS pending,
          COUNT(t.id) FILTER (WHERE t.status = 'In Progress')::int AS in_progress,
          COUNT(t.id) FILTER (WHERE t.status = 'Completed')::int AS completed
        FROM tasks t
        JOIN users u ON t.created_by = u.id
        WHERE t.is_deleted = false
        GROUP BY u.name, t.created_by
        ORDER BY total_tasks DESC
      `,
      // Total Business Expenses (for Net Cash Flow)
      sql`
        SELECT COALESCE(SUM(amount), 0)::numeric as total
        FROM business_expenses
        WHERE is_deleted = false
      `
    ]);

    // Secondary Calculations
    const unitsSold = Number(orderSummary[0]?.total_units || 0);
    const revenue = Number(orderSummary[0]?.gross_revenue || 0);
    const returnUnits = Number(returnSummary[0]?.return_units || 0);
    const returnLoss = Number(returnSummary[0]?.return_loss || 0);
    const cogs = Number(productCosts[0]?.total_cost || 0);

    const netProfit = revenue - cogs - returnLoss;
    const returnRate = unitsSold > 0 ? (returnUnits / unitsSold) * 100 : 0;

    const summary = {
      total_orders: Number(orderSummary[0]?.total_orders || 0),
      total_units: unitsSold,
      gross_revenue: revenue,
      net_profit: netProfit,
      return_rate: returnRate,
    };

    // Task progress calculation
    const fashionTasks = taskProgressRes.filter((t: any) => t.task_group === 'Fashion');
    const fashionTotal = fashionTasks.length;
    const fashionCompleted = fashionTasks.filter((t: any) => t.status === 'Completed').length;
    const taskProgress = {
      fashion: {
        total: fashionTotal,
        completed: fashionCompleted,
        percentage: fashionTotal > 0 ? (fashionCompleted / fashionTotal) * 100 : 0
      },
      overall: {
        total: fashionTotal,
        completed: fashionCompleted
      }
    };

    const totalPaymentReceived = Number(payoutRes[0]?.total || 0);
    const totalExpenses = Number(expenseRes[0]?.total || 0);
    const netCashFlow = totalPaymentReceived - totalExpenses;

    return NextResponse.json({
      success: true,
      summary,
      netCashFlow,
      totalPaymentReceived,
      inventoryValue: Number(inventoryRes[0]?.total || 0),
      taskProgress,
      trackRecord: (trackRecordRes || []).map((t: any) => ({
        user_name: t.user_name,
        created_by: t.created_by,
        total_tasks: Number(t.total_tasks),
        pending: Number(t.pending),
        in_progress: Number(t.in_progress),
        completed: Number(t.completed)
      })),
      topSellingProducts: topSellingRes.map((p: any) => ({
        ...p,
        total_revenue: Number(p.total_revenue),
        total_units_sold: Number(p.total_units_sold)
      })),
      platformPerformance: [],
      ordersReturnsData: [],
      recentOrders: []
    });

  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch dashboard data", error: error.message }, { status: 500 });
  }
}
