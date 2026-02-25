import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-dev-only",
  debug: process.env.NODE_ENV === "development",
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Use the simplified sql helper
          const users = await sql`
            SELECT id, email, password, name, role 
            FROM users 
            WHERE LOWER(email) = LOWER(${credentials.email})
            LIMIT 1
          `;

          if (!users || users.length === 0) {
            console.warn(`Auth: No user found with email ${credentials.email}`);
            return null;
          }

          const user = users[0];

          const isValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isValid) {
            console.warn(`Auth: Invalid password for user ${credentials.email}`);
            return null;
          }

          return {
            id: String(user.id),
            email: user.email,
            name: user.name || user.email.split('@')[0],
            role: user.role || 'admin',
          };
        } catch (error) {
          console.error("Auth: Authorization database error:", error);
          // Return null instead of throwing to avoid 500 HTML error pages
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
};
