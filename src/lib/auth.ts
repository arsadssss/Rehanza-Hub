import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
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
          console.log("Auth: Missing credentials");
          return null;
        }

        try {
          console.log("Auth: Attempting login for:", credentials.email);

          // Query user from Neon using case-insensitive email matching
          const users = await sql`
            SELECT id, email, password, name, role 
            FROM users 
            WHERE LOWER(email) = LOWER(${credentials.email})
            LIMIT 1
          `;

          const user = users[0];

          if (!user) {
            console.log("Auth: User not found in database");
            return null;
          }

          // Verify password using bcrypt
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          console.log("Auth: Database user found:", { email: user.email, role: user.role });
          console.log("Auth: Password valid:", isPasswordValid);

          if (!isPasswordValid) {
            console.log("Auth: Invalid password provided");
            return null;
          }

          // Return successful user object
          return {
            id: user.id,
            email: user.email,
            name: user.name || user.email.split('@')[0],
            role: user.role,
          };
        } catch (error) {
          console.error("Auth: Fatal error during authorization:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
};
