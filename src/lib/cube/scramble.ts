import { FACE_LETTER } from './facelet';

/** Scramble lengths roughly matching WCA practice for each size. */
const LENGTHS: Record<number, number> = { 2: 11, 3: 20, 4: 45, 5: 60, 6: 80, 7: 100 };

const AXIS = [0, 1, 2, 0, 1, 2]; // U/D share an axis, R/L, F/B

function randInt(n: number): number {
  return Math.floor(Math.random() * n);
}

/**
 * Random-move scramble. Never turns the same axis twice in a row, which is
 * what keeps a scramble from containing trivially cancelling pairs.
 * Cubes of 4 and above also get wide turns, up to half the cube's depth.
 */
export function scramble(n: number): string[] {
  const length = LENGTHS[n] ?? 60;
  const faces = n === 2 ? [0, 1, 2] : [0, 1, 2, 3, 4, 5]; // 2x2 uses U, R, F only
  const maxSpan = n >= 4 ? Math.floor(n / 2) : 1;
  const out: string[] = [];
  let lastAxis = -1;

  while (out.length < length) {
    const face = faces[randInt(faces.length)];
    if (AXIS[face] === lastAxis) continue;
    let token = FACE_LETTER[face] as string;
    if (maxSpan > 1) {
      const span = 1 + randInt(maxSpan);
      if (span === 2) token += 'w';
      else if (span > 2) token = span + token + 'w';
    }
    token += ['', '2', "'"][randInt(3)];
    out.push(token);
    lastAxis = AXIS[face];
  }
  return out;
}

export const SIZES = [2, 3, 4, 5, 6, 7] as const;
export type CubeSize = (typeof SIZES)[number];
