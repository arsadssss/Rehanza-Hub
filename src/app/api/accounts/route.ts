import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const accounts = await sql`
      SELECT id, name
      FROM accounts
      ORDER BY name ASC
    `;

    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    console.error("Accounts fetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}