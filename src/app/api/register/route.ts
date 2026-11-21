import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { check, clientKey } from '@/lib/rate-limit';
import {
  displayNameFrom, emailProblem, nameProblem, normaliseEmail, passwordProblem,
} from '@/lib/validate';

// bcrypt needs the Node runtime, and the work factor below rules out the edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** ~250ms per hash on current hardware: slow enough to matter, fast enough to serve. */
const BCRYPT_ROUNDS = 12;

export async function POST(request: Request) {
  const limit = check(clientKey(request, 'register'), 5, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many accounts created from here. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const email = normaliseEmail(String(body.email ?? ''));
  const password = String(body.password ?? '');
  const name = String(body.name ?? '');

  const problem = emailProblem(email) ?? passwordProblem(password) ?? nameProblem(name);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    await prisma.user.create({
      data: { email, passwordHash, name: displayNameFrom(name, email) },
      select: { id: true },
    });
  } catch (error) {
    // P2002 is Prisma's unique-constraint code; read off the error rather than
    // imported as a type, so this file does not depend on generated output.
    const code = (error as { code?: string } | null)?.code;
    if (code === 'P2002') {
      // Saying "that address is taken" confirms who has an account here. The
      // client treats this status as "now try signing in", which is the right
      // next step whether or not the account is theirs.
      return NextResponse.json({ error: 'That email address cannot be registered.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Could not create the account.' }, { status: 500 });
  }

  // The client signs in straight afterwards through Auth.js, so no session is
  // issued here.
  return NextResponse.json({ ok: true }, { status: 201 });
}
