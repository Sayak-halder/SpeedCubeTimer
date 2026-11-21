import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Best single per person for one cube size. DNFs are stored with a null
 * effectiveMs, so they drop out of the minimum without a special case.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const size = Number(searchParams.get('size') ?? 3);
  if (!Number.isInteger(size) || size < 2 || size > 7) {
    return NextResponse.json({ error: 'size must be 2 to 7' }, { status: 400 });
  }

  const grouped = await prisma.solve.groupBy({
    by: ['userId'],
    where: { size, effectiveMs: { not: null } },
    _min: { effectiveMs: true },
    _count: { _all: true },
    orderBy: { _min: { effectiveMs: 'asc' } },
    take: 50,
  });

  if (grouped.length === 0) return NextResponse.json({ entries: [] });

  type Row = { userId: string; _min: { effectiveMs: number | null }; _count: { _all: number } };
  type UserRow = { id: string; name: string | null; image: string | null };
  const rows = grouped as unknown as Row[];

  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((g) => g.userId) } },
    select: { id: true, name: true, image: true },
  });
  const byId = new Map((users as unknown as UserRow[]).map((u) => [u.id, u]));

  const entries = rows.map((g) => {
    const user = byId.get(g.userId);
    return {
      userId: g.userId,
      name: user?.name ?? 'Anonymous cuber',
      image: user?.image ?? null,
      bestMs: g._min.effectiveMs,
      solveCount: g._count._all,
    };
  });

  return NextResponse.json({ entries });
}
