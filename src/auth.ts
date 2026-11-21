import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { normaliseEmail } from '@/lib/validate';
import { check, clientKey } from '@/lib/rate-limit';

/**
 * A bcrypt hash of a value nobody will guess. Compared against when no user
 * matches, so a request for an unknown address costs the same time as one for
 * a known address — otherwise response timing tells an attacker which email
 * addresses have accounts.
 */
const DUMMY_HASH = '$2b$12$gaK0TmZOBe5IjZ3QcRZirOJTcWBdF8QF40kH4EdasSR7qltuKcy3y';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // The credentials provider cannot use database sessions: there is no
  // adapter hook that issues one on a successful password check.
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: '/signin' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw, request) {
        const email = normaliseEmail(String(raw?.email ?? ''));
        const password = String(raw?.password ?? '');
        if (!email || !password) return null;

        // Per-address as well as per-IP, so one account cannot be ground
        // down from a pool of addresses. See the note in rate-limit.ts about
        // what this does and does not stop on serverless.
        const perIp = check(clientKey(request as Request, 'login-ip'), 20, 15 * 60 * 1000);
        const perEmail = check(`login-email:${email}`, 10, 15 * 60 * 1000);
        if (!perIp.ok || !perEmail.ok) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, name: true, email: true, passwordHash: true },
        });

        // Always compare, so the work done is the same either way.
        const hash = user?.passwordHash ?? DUMMY_HASH;
        const ok = await bcrypt.compare(password, hash);
        if (!ok || !user?.passwordHash) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
