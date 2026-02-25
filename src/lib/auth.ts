import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true, // Keep enabled to debug cloud environment handshake
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
          console.error("Auth: Missing credentials in request");
          return null;
        }

        try {
          console.log(`Auth: Attempting login for ${credentials.email}`);
          
          // Query user from Neon using case-insensitive email matching
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

          // Verify password using bcrypt
          const isValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!isValid) {
            console.warn(`Auth: Invalid password for user ${credentials.email}`);
            return null;
          }

          console.log(`Auth: Success! User ${user.email} authenticated.`);

          // Return successful user object with string ID
          return {
            id: String(user.id),
            email: user.email,
            name: user.name || user.email.split('@')[0],
            role: user.role || 'admin',
          };
        } catch (error) {
          console.error("Auth: Fatal error during authorization query:", error);
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
