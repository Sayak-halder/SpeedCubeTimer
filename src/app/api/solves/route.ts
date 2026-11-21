import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const PENALTIES = ['OK', 'PLUS2', 'DNF'] as const;
type Penalty = (typeof PENALTIES)[number];

function effectiveMs(ms: number, penalty: Penalty): number | null {
  if (penalty === 'DNF') return null;
  return penalty === 'PLUS2' ? ms + 2000 : ms;
}

/** Recent solves for the signed-in user, newest first. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ solves: [] });

  const { searchParams } = new URL(request.url);
  const size = Number(searchParams.get('size') ?? 3);
  if (!Number.isInteger(size) || size < 2 || size > 7) {
    return NextResponse.json({ error: 'size must be 2 to 7' }, { status: 400 });
  }

  const solves = await prisma.solve.findMany({
    where: { userId: session.user.id, size },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, ms: true, penalty: true, scramble: true, createdAt: true },
  });

  return NextResponse.json({ solves });
}

/** Record one solve. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to save solves' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const { size, ms, penalty = 'OK', scramble } = (body ?? {}) as Record<string, unknown>;

  if (!Number.isInteger(size) || (size as number) < 2 || (size as number) > 7) {
    return NextResponse.json({ error: 'size must be 2 to 7' }, { status: 400 });
  }
  if (!Number.isFinite(ms) || (ms as number) <= 0 || (ms as number) > 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'ms is out of range' }, { status: 400 });
  }
  if (!PENALTIES.includes(penalty as Penalty)) {
    return NextResponse.json({ error: 'penalty must be OK, PLUS2 or DNF' }, { status: 400 });
  }
  if (typeof scramble !== 'string' || scramble.length > 2000) {
    return NextResponse.json({ error: 'scramble is missing or too long' }, { status: 400 });
  }

  const rounded = Math.round(ms as number);
  const solve = await prisma.solve.create({
    data: {
      userId: session.user.id,
      size: size as number,
      ms: rounded,
      penalty: penalty as Penalty,
      effectiveMs: effectiveMs(rounded, penalty as Penalty),
      scramble,
    },
    select: { id: true, ms: true, penalty: true, scramble: true, createdAt: true },
  });

  return NextResponse.json({ solve }, { status: 201 });
}

/** Update the penalty on a solve, or delete it. */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { id, penalty, remove } = body;
  if (typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  // Scope by userId so one person cannot touch another's rows.
  const existing = await prisma.solve.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, ms: true },
  });
  if (!existing) return NextResponse.json({ error: 'Solve not found' }, { status: 404 });

  if (remove === true) {
    await prisma.solve.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  }

  if (!PENALTIES.includes(penalty as Penalty)) {
    return NextResponse.json({ error: 'penalty must be OK, PLUS2 or DNF' }, { status: 400 });
  }

  const solve = await prisma.solve.update({
    where: { id: existing.id },
    data: {
      penalty: penalty as Penalty,
      effectiveMs: effectiveMs(existing.ms, penalty as Penalty),
    },
    select: { id: true, ms: true, penalty: true, scramble: true, createdAt: true },
  });

  return NextResponse.json({ solve });
}
