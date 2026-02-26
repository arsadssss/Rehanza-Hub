import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";

/**
 * POST /api/profile/change-password
 * Handles password updates for the currently logged-in user.
 * 
 * Requirements:
 * - session.user.id must match the row being updated.
 * - currentPassword must be verified via bcrypt before update.
 */
export async function POST(request: Request) {
  try {
    // 1. Protect the route - check for active session
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: "Current and new passwords are required." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: "New password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    // 3. Fetch the current user's hashed password from database
    const users = await sql`
      SELECT id, password 
      FROM public.users 
      WHERE id = ${session.user.id}
      LIMIT 1
    `;

    if (users.length === 0) {
      return NextResponse.json(
        { success: false, message: "User record not found." },
        { status: 404 }
      );
    }

    const user = users[0];

    // 4. Verify the current password matches what's in the DB
    const isCurrentPasswordCorrect = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isCurrentPasswordCorrect) {
      return NextResponse.json(
        { success: false, message: "Current password incorrect." },
        { status: 400 }
      );
    }

    // 5. Hash the new password and update the database
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await sql`
      UPDATE public.users
      SET password = ${hashedNewPassword}
      WHERE id = ${session.user.id}
    `;

    return NextResponse.json({
      success: true,
      message: "Password updated successfully.",
    });

  } catch (error: any) {
    console.error("Change Password API Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "Failed to update password due to a server error.", 
        error: error.message 
      },
      { status: 500 }
    );
  }
}
