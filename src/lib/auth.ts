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
          // Query user from Neon using case-insensitive email matching
          const users = await sql`
            SELECT id, email, password, name, role 
            FROM users 
            WHERE LOWER(email) = LOWER(${credentials.email})
            LIMIT 1
          `;

          const user = users[0];

          if (!user) {
            console.log("Authorize user: Not found");
            return null;
          }

          // Verify password using bcrypt
          const isValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          console.log("Authorize user:", { id: user.id, email: user.email, role: user.role });
          console.log("Password valid:", isValid);

          if (!isValid) {
            console.log("Auth: Invalid password");
            return null;
          }

          // Return successful user object with string ID
          return {
            id: String(user.id),
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
