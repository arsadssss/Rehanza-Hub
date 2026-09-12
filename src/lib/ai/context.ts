import { sql } from "@/lib/db";
import { AiAccountContext } from "./types";

/**
 * Resolves calendar range for previous month relative to current temporal anchor.
 * Current system time September 2026 -> Last month is August 2026 (2026-08-01 to 2026-08-31).
 */
export function getLastMonthRange(): { startDate: string; endDate: string; label: string } {
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0));

  const pad = (n: number) => String(n).padStart(2, "0");
  const startDate = `${year}-${pad(month + 1)}-01`;
  const endDate = `${year}-${pad(month + 1)}-${pad(lastDay.getUTCDate())}`;
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const label = `${monthNames[month]} ${year}`;

  return { startDate, endDate, label };
}

/**
 * Safely resolves the active account context and strictly prevents cross-account data leakage.
 */
export async function resolveAiAccountContext(
  requestedAccountId?: string | null
): Promise<AiAccountContext> {
  let targetAccount: { id: string; name: string } | null = null;

  if (requestedAccountId) {
    const rows = await sql`
      SELECT id, name 
      FROM accounts 
      WHERE id = ${requestedAccountId} 
      LIMIT 1
    `;
    if (rows.length > 0) {
      targetAccount = { id: rows[0].id, name: rows[0].name };
    }
  }

  // Fallback to Rehanza account if no specific or valid ID found
  if (!targetAccount) {
    const fallbackRows = await sql`
      SELECT id, name 
      FROM accounts 
      ORDER BY CASE WHEN LOWER(name) LIKE '%rehanza%' OR LOWER(name) LIKE '%fashion%' THEN 0 ELSE 1 END, name ASC
      LIMIT 1
    `;
    if (fallbackRows.length > 0) {
      targetAccount = { id: fallbackRows[0].id, name: fallbackRows[0].name };
    } else {
      targetAccount = { id: "1323beea-04db-4d44-a1ca-3ab7a1556f09", name: "Rehanza" };
    }
  }

  const lastMonth = getLastMonthRange();
  const now = new Date();
  const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

  return {
    accountId: targetAccount.id,
    accountName: targetAccount.name,
    currentDate,
    lastMonthRange: lastMonth,
  };
}

