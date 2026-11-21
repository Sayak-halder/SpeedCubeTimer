export type Penalty = 'OK' | 'PLUS2' | 'DNF';

export interface Solve {
  id: string;
  ms: number;
  penalty: Penalty;
  scramble: string;
  createdAt: string;
  /** True while the solve is only in the browser, not yet saved server-side. */
  local?: boolean;
}

/** The time that counts: raw, plus two seconds for a +2, or DNF. */
export function effective(solve: Solve): number {
  if (solve.penalty === 'DNF') return Infinity;
  return solve.ms + (solve.penalty === 'PLUS2' ? 2000 : 0);
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (!Number.isFinite(ms)) return 'DNF';
  const seconds = ms / 1000;
  if (seconds < 60) return seconds.toFixed(2);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds - minutes * 60).toFixed(2).padStart(5, '0')}`;
}

/**
 * WCA average of N: drop the best and the worst, mean the rest. One DNF
 * becomes the dropped worst; two or more make the whole average a DNF.
 * `solves` is newest-first, so the window is the head of the list.
 */
export function averageOf(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  const window = solves.slice(0, n).map(effective);
  const dnfs = window.filter((t) => !Number.isFinite(t)).length;
  if (dnfs > 1) return Infinity;
  const sorted = [...window].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, sorted.length - 1);
  if (trimmed.some((t) => !Number.isFinite(t))) return Infinity;
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

/** Best single, ignoring DNFs. */
export function bestSingle(solves: Solve[]): number | null {
  const times = solves.map(effective).filter((t) => Number.isFinite(t));
  return times.length ? Math.min(...times) : null;
}

/** Best rolling average of N across the whole list. */
export function bestAverage(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  let best: number | null = null;
  for (let i = 0; i + n <= solves.length; i++) {
    const avg = averageOf(solves.slice(i), n);
    if (avg != null && Number.isFinite(avg) && (best == null || avg < best)) best = avg;
  }
  return best;
}
