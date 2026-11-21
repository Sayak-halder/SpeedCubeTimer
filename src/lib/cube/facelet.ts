/**
 * Facelet model for an N x N x N cube.
 *
 * Faces are stored in the order U, R, F, D, L, B. Each face is an N x N grid
 * read from outside the cube, with these conventions (the standard Kociemba
 * layout, extended to any N):
 *
 *   U  row 0 = back edge,  col 0 = left
 *   R  row 0 = top edge,   col 0 = front
 *   F  row 0 = top edge,   col 0 = left
 *   D  row 0 = front edge, col 0 = left
 *   L  row 0 = top edge,   col 0 = back
 *   B  row 0 = top edge,   col 0 = right
 *
 * Only U and R turns are derived by hand. Every other face is a conjugate of
 * one of them by a whole-cube rotation, which is in turn the product of that
 * same turn applied at every depth. That keeps the hand-written surface small;
 * `verify.ts` checks the whole thing against the independent cubie model.
 */

export const U = 0, R = 1, F = 2, D = 3, L = 4, B = 5;
export const FACE_ORDER = [U, R, F, D, L, B] as const;
export const FACE_LETTER = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

export type Facelets = Uint8Array;

export interface Cube {
  readonly n: number;
  readonly f: Facelets;
}

export function solved(n: number): Cube {
  const f = new Uint8Array(6 * n * n);
  for (let face = 0; face < 6; face++) f.fill(face, face * n * n, (face + 1) * n * n);
  return { n, f };
}

export function clone(c: Cube): Cube {
  return { n: c.n, f: c.f.slice() };
}

export function isSolved(c: Cube): boolean {
  const sq = c.n * c.n;
  for (let face = 0; face < 6; face++) {
    const first = c.f[face * sq];
    for (let i = 1; i < sq; i++) if (c.f[face * sq + i] !== first) return false;
  }
  return true;
}

const at = (n: number, face: number, r: number, col: number) => face * n * n + r * n + col;

/** Rotate one face's stickers a quarter turn clockwise, in place. */
function rotateFace(f: Facelets, n: number, face: number, times: number): void {
  const t = ((times % 4) + 4) % 4;
  for (let k = 0; k < t; k++) {
    const copy = f.slice(face * n * n, (face + 1) * n * n);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        // clockwise: new[r][c] = old[n-1-c][r]
        f[at(n, face, r, c)] = copy[(n - 1 - c) * n + r];
      }
    }
  }
}

/**
 * One clockwise quarter turn of the U face at `depth` (0 = the U layer itself,
 * n-1 = the D layer). Strips move F -> L -> B -> R -> F, each keeping its
 * column index.
 */
function turnU(c: Cube, depth: number): void {
  const { n, f } = c;
  const row = depth;
  const tmp = new Uint8Array(n);
  for (let col = 0; col < n; col++) tmp[col] = f[at(n, F, row, col)];
  for (let col = 0; col < n; col++) f[at(n, F, row, col)] = f[at(n, R, row, col)];
  for (let col = 0; col < n; col++) f[at(n, R, row, col)] = f[at(n, B, row, col)];
  for (let col = 0; col < n; col++) f[at(n, B, row, col)] = f[at(n, L, row, col)];
  for (let col = 0; col < n; col++) f[at(n, L, row, col)] = tmp[col];
  if (depth === 0) rotateFace(f, n, U, 1);
  if (depth === n - 1) rotateFace(f, n, D, -1);
}

/**
 * One clockwise quarter turn of the R face at `depth` (0 = the R layer).
 * F -> U -> B -> D -> F; the two transitions through B reverse the row order,
 * because B is indexed from the opposite side.
 */
function turnR(c: Cube, depth: number): void {
  const { n, f } = c;
  const near = n - 1 - depth; // column index on U, F and D
  const far = depth;          // column index on B
  const tmp = new Uint8Array(n);
  for (let r = 0; r < n; r++) tmp[r] = f[at(n, U, r, near)];
  // U <- F
  for (let r = 0; r < n; r++) f[at(n, U, r, near)] = f[at(n, F, r, near)];
  // F <- D
  for (let r = 0; r < n; r++) f[at(n, F, r, near)] = f[at(n, D, r, near)];
  // D <- B (reversed)
  for (let r = 0; r < n; r++) f[at(n, D, n - 1 - r, near)] = f[at(n, B, r, far)];
  // B <- U (reversed)
  for (let r = 0; r < n; r++) f[at(n, B, n - 1 - r, far)] = tmp[r];
  if (depth === 0) rotateFace(f, n, R, 1);
  if (depth === n - 1) rotateFace(f, n, L, -1);
}

/** Whole-cube rotation about the U axis (same direction as a U turn). */
function rotY(c: Cube, times = 1): void {
  for (let k = 0; k < ((times % 4) + 4) % 4; k++) {
    for (let d = 0; d < c.n; d++) turnU(c, d);
  }
}

/** Whole-cube rotation about the R axis (same direction as an R turn). */
function rotX(c: Cube, times = 1): void {
  for (let k = 0; k < ((times % 4) + 4) % 4; k++) {
    for (let d = 0; d < c.n; d++) turnR(c, d);
  }
}

export type Axis = typeof U | typeof R | typeof F | typeof D | typeof L | typeof B;

/**
 * Apply `amount` quarter turns (1, 2 or 3) of `face` at the given depths.
 * Depth 0 is the outermost layer of that face.
 */
export function turn(c: Cube, face: number, depths: number[], amount: number): void {
  const a = ((amount % 4) + 4) % 4;
  if (a === 0) return;
  for (let k = 0; k < a; k++) {
    switch (face) {
      case U:
        for (const d of depths) turnU(c, d);
        break;
      case R:
        for (const d of depths) turnR(c, d);
        break;
      case F:
        // Bring F to the U position, turn, put it back.
        rotX(c, 1);
        for (const d of depths) turnU(c, d);
        rotX(c, -1);
        break;
      case D:
        rotX(c, 2);
        for (const d of depths) turnU(c, d);
        rotX(c, -2);
        break;
      case L:
        rotY(c, 2);
        for (const d of depths) turnR(c, d);
        rotY(c, -2);
        break;
      case B:
        rotY(c, 2);
        rotX(c, 1);
        for (const d of depths) turnU(c, d);
        rotX(c, -1);
        rotY(c, -2);
        break;
    }
  }
}

// --- notation -------------------------------------------------------------

export interface Move {
  face: number;
  depths: number[];
  amount: number;
  token: string;
}

const LETTER_INDEX: Record<string, number> = { U, R, F, D, L, B };

/**
 * Parse one token of standard notation: `R`, `R'`, `R2`, `Rw`, `Rw'`, `3Rw2`.
 * A wide turn covers every layer from the face inward.
 */
export function parseMove(token: string): Move | null {
  const m = /^(\d*)([URFDLB])(w?)(['2]?)$/.exec(token.trim());
  if (!m) return null;
  const [, countRaw, letter, wide, suffix] = m;
  const face = LETTER_INDEX[letter];
  let span = 1;
  if (wide) span = countRaw ? parseInt(countRaw, 10) : 2;
  else if (countRaw) return null; // "3R" without w is slice notation; not used here
  const depths: number[] = [];
  for (let d = 0; d < span; d++) depths.push(d);
  const amount = suffix === '2' ? 2 : suffix === "'" ? 3 : 1;
  return { face, depths, amount, token };
}

export function parseAlg(alg: string | string[]): Move[] {
  const tokens = Array.isArray(alg) ? alg : alg.trim().split(/\s+/).filter(Boolean);
  const out: Move[] = [];
  for (const t of tokens) {
    const mv = parseMove(t);
    if (mv) out.push(mv);
  }
  return out;
}

export function applyAlg(c: Cube, alg: string | string[] | Move[]): Cube {
  const moves = Array.isArray(alg) && typeof alg[0] === 'object'
    ? (alg as Move[])
    : parseAlg(alg as string | string[]);
  for (const mv of moves) turn(c, mv.face, mv.depths, mv.amount);
  return c;
}

export function fromAlg(n: number, alg: string | string[]): Cube {
  const c = solved(n);
  applyAlg(c, alg);
  return c;
}

export function invertAlg(tokens: string[]): string[] {
  return tokens
    .slice()
    .reverse()
    .map((t) => (t.endsWith('2') ? t : t.endsWith("'") ? t.slice(0, -1) : t + "'"));
}

/** Read one face as a grid of face-colour indices, for rendering. */
export function faceGrid(c: Cube, face: number): number[][] {
  const { n, f } = c;
  const out: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row: number[] = [];
    for (let col = 0; col < n; col++) row.push(f[at(n, face, r, col)]);
    out.push(row);
  }
  return out;
}
