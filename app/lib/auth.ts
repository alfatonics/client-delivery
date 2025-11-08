import { compare } from "bcryptjs";
import NextAuth, {
  type AuthOptions,
  type User,
  getServerSession,
} from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/app/lib/prisma";
import { z } from "zod";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: "ADMIN" | "STAFF" | "CLIENT";
};

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const authConfig: AuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;
        const sessionUser: SessionUser = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        } as SessionUser;
        return sessionUser as unknown as User;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user?: any }) {
      if (user) {
        const u = user as unknown as SessionUser;
        token.user = { id: u.id, email: u.email, name: u.name, role: u.role };
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      session.user = token.user as SessionUser;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
  },
};

// Route handler for App Router
export const authHandlers = NextAuth(authConfig);

// Session getter for server components and API routes
export async function auth() {
  return await getServerSession(authConfig);
}
