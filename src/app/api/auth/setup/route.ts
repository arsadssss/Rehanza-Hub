import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

/**
 * One-time setup route to clear existing users and provision 
 * Admin and Manager accounts with hashed passwords.
 * 
 * VISIT: /api/auth/setup
 */
export async function GET() {
  try {
    console.log("Auth Setup: Starting database reset...");

    // 1. Delete all existing users
    await sql`DELETE FROM users`;
    console.log("Auth Setup: Existing users cleared.");

    // 2. Prepare new users
    const usersToCreate = [
      {
        email: 'arsh@rehanza.com',
        password: 'Arsh@8573',
        name: 'Arsh Admin',
        role: 'admin'
      },
      {
        email: 'ahmad@rehanza.com',
        password: 'Ahmad@3070',
        name: 'Ahmad Manager',
        role: 'manager'
      }
    ];

    // 3. Hash and Insert users
    for (const u of usersToCreate) {
      const hashedPassword = await bcrypt.hash(u.password, 10);
      
      await sql`
        INSERT INTO users (name, email, password, role)
        VALUES (${u.name}, ${u.email}, ${hashedPassword}, ${u.role})
      `;
      console.log(`Auth Setup: Created user ${u.email}`);
    }

    return NextResponse.json({
      success: true,
      message: "Database reset complete. Admin and Manager users created successfully.",
      usersCreated: usersToCreate.map(u => ({ email: u.email, role: u.role }))
    });

  } catch (error: any) {
    console.error("Auth Setup Error:", error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
