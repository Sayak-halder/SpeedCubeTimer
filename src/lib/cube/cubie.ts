/**
 * Cubie model of the 3x3 (and, using corners only, the 2x2) plus a
 * layer-by-layer solver.
 *
 * Corners: URF0 UFL1 ULB2 UBR3 DFR4 DLF5 DBL6 DRB7
 * Edges:   UR0 UF1 UL2 UB3 DR4 DF5 DL6 DB7 FR8 FL9 BL10 BR11
 *
 * Each solve phase is a breadth-first search over a move or macro alphabet,
 * de-duplicated on a key built only from the pieces that phase cares about.
 * Bounding the key space is what keeps the search tractable without pruning
 * tables; the cost is that solutions are correct rather than short.
 */

export interface CubieState {
  cp: number[];
  co: number[];
  ep: number[];
  eo: number[];
}

interface Entry { seq: string[] }
interface Slot { corner: number; edge: number; faces: string[] }

/* Cube engine + solver.
   Cubie-level 3x3 model (Kociemba numbering), reused for 2x2 (corners only).

   Corners: URF0 UFL1 ULB2 UBR3 DFR4 DLF5 DBL6 DRB7
   Edges:   UR0 UF1 UL2 UB3 DR4 DF5 DL6 DB7 FR8 FL9 BL10 BR11
*/

const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

// Base quarter-turn (clockwise) definitions.
const BASE: Record<string, CubieState> = {
  U: {
    cp: [3, 0, 1, 2, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  R: {
    cp: [4, 1, 2, 0, 7, 5, 6, 3], co: [2, 0, 0, 1, 1, 0, 0, 2],
    ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  F: {
    cp: [1, 5, 2, 3, 0, 4, 6, 7], co: [1, 2, 0, 0, 2, 1, 0, 0],
    ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11], eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0],
  },
  D: {
    cp: [0, 1, 2, 3, 5, 6, 7, 4], co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  L: {
    cp: [0, 2, 6, 3, 4, 1, 5, 7], co: [0, 1, 2, 0, 0, 2, 1, 0],
    ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  B: {
    cp: [0, 1, 3, 7, 4, 5, 2, 6], co: [0, 0, 1, 2, 0, 0, 2, 1],
    ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7], eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1],
  },
};

const SOLVED: CubieState = {
  cp: [0, 1, 2, 3, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0],
  ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

export function cloneState(s: CubieState): CubieState {
  return { cp: s.cp.slice(), co: s.co.slice(), ep: s.ep.slice(), eo: s.eo.slice() };
}

// Apply transform t to state s (s then t).
function compose(s: CubieState, t: CubieState): CubieState {
  const cp = new Array(8), co = new Array(8), ep = new Array(12), eo = new Array(12);
  for (let i = 0; i < 8; i++) {
    cp[i] = s.cp[t.cp[i]];
    co[i] = (s.co[t.cp[i]] + t.co[i]) % 3;
  }
  for (let i = 0; i < 12; i++) {
    ep[i] = s.ep[t.ep[i]];
    eo[i] = (s.eo[t.ep[i]] + t.eo[i]) % 2;
  }
  return { cp, co, ep, eo };
}

// Build the 18 move transforms.
const MOVES: Record<string, CubieState> = {};
const MOVE_NAMES: string[] = [];
for (const f of FACES) {
  let acc = cloneState(SOLVED);
  for (let r = 1; r <= 3; r++) {
    acc = compose(acc, BASE[f]);
    const name = f + (r === 1 ? '' : r === 2 ? '2' : "'");
    MOVES[name] = cloneState(acc);
    MOVE_NAMES.push(name);
  }
}

export function applyMove(s: CubieState, name: string): CubieState { return compose(s, MOVES[name]); }
export function applySeq(s: CubieState, seq: string[]): CubieState {
  let cur = s;
  for (const m of seq) cur = applyMove(cur, m);
  return cur;
}

export function invertSeq(seq: string[]): string[] {
  return seq.slice().reverse().map((m: string) => {
    if (m.endsWith('2')) return m;
    if (m.endsWith("'")) return m[0];
    return m + "'";
  });
}

// --- Generic sub-goal search ----------------------------------------------

/* BFS over a move/macro alphabet, de-duplicating on a key built only from the
   pieces that matter for this phase. The key space bounds the search, which is
   what keeps this tractable without pruning tables. */
function searchPhase(
  start: CubieState,
  alphabet: Entry[],
  keyFn: (s: CubieState) => string,
  isGoal: (s: CubieState) => boolean,
  maxDepth: number,
): string[] | null {
  if (isGoal(start)) return [];
  const seen = new Set([keyFn(start)]);
  let frontier: { s: CubieState; path: string[] }[] = [{ s: start, path: [] }];
  for (let d = 0; d < maxDepth; d++) {
    const next: { s: CubieState; path: string[] }[] = [];
    for (const node of frontier) {
      for (const entry of alphabet) {
        const s2 = applySeq(node.s, entry.seq);
        const k = keyFn(s2);
        if (seen.has(k)) continue;
        const path = node.path.concat(entry.seq);
        if (isGoal(s2)) return path;
        seen.add(k);
        next.push({ s: s2, path });
      }
    }
    if (!next.length) break;
    frontier = next;
  }
  return null;
}

const singleMoves = MOVE_NAMES.map((m) => ({ seq: [m] }));
const uMoves = ["U", "U2", "U'"].map((m) => ({ seq: [m] }));

function parseAlg(str: string): string[] { return str.trim().split(/\s+/); }

// --- Phase definitions (layer-by-layer) ------------------------------------

const CROSS_EDGES = [4, 5, 6, 7];            // DR DF DL DB
const SLOTS = [
  { corner: 4, edge: 8, faces: ['R', 'F'] },  // DFR / FR
  { corner: 5, edge: 9, faces: ['F', 'L'] },  // DLF / FL
  { corner: 6, edge: 10, faces: ['L', 'B'] }, // DBL / BL
  { corner: 7, edge: 11, faces: ['B', 'R'] }, // DRB / BR
];

function slotMacros(faces: string[]): Entry[] {
  const out: Entry[] = [];
  for (const X of faces) {
    for (const a of [X, X + "'"]) {
      for (const u of ['U', "U'", 'U2']) {
        const inv = a.endsWith("'") ? a[0] : a + "'";
        out.push({ seq: [a, u, inv] });
      }
    }
  }
  return out;
}

function edgeKeyPart(s: CubieState, idxs: number[]): string {
  let k = '';
  for (const i of idxs) {
    const pos = s.ep.indexOf(i);
    k += pos + ':' + s.eo[pos] + ',';
  }
  return k;
}
function cornerKeyPart(s: CubieState, idxs: number[]): string {
  let k = '';
  for (const i of idxs) {
    const pos = s.cp.indexOf(i);
    k += pos + ':' + s.co[pos] + ',';
  }
  return k;
}
function edgesSolved(s: CubieState, idxs: number[]): boolean {
  return idxs.every((i: number) => s.ep[i] === i && s.eo[i] === 0);
}
function cornersSolved(s: CubieState, idxs: number[]): boolean {
  return idxs.every((i: number) => s.cp[i] === i && s.co[i] === 0);
}

const SUNE = parseAlg("R U R' U R U2 R'");
const FSEXY = parseAlg("F R U R' U' F'");
const TPERM = parseAlg("R U R' U' R' F R2 U' R' U' R U R' F'");
const UPERM = parseAlg("R U' R U R U R U' R' U' R2");
const ANTISUNE = parseAlg("R U2 R' U' R U' R'");
const JPERM = parseAlg("R U R' F' R U R' U' R' F R2 U' R'");

let LAST_FAIL: string | null = null;
function basicTriggers(): Entry[] {
  const out: Entry[] = [];
  for (const slot of SLOTS) {
    const X = slot.faces[0];
    const Xi = X + "'";
    for (const u of ['U', "U'", 'U2']) {
      out.push({ seq: [X, u, Xi] });
      out.push({ seq: [Xi, u, X] });
    }
  }
  return out;
}
const TRIGGERS = basicTriggers();

function cornerAtU(st: CubieState, piece: number): boolean { return st.cp.indexOf(piece) < 4; }
function edgeAtU(st: CubieState, piece: number): boolean { return st.ep.indexOf(piece) < 4; }

function solveSlot(
  s: CubieState,
  slot: Slot,
  solvedCorners: number[],
  solvedEdges: number[],
  cornersOnly: boolean,
): string[] | null {
  const cGroup = solvedCorners.concat([slot.corner]);
  const eGroup: number[] = cornersOnly ? [] : solvedEdges.concat([slot.edge]);
  const prevC: number[] = solvedCorners;
  const prevE: number[] = cornersOnly ? [] : solvedEdges;

  const fullKey = (st: CubieState) => cornerKeyPart(st, cGroup) + '|' + edgeKeyPart(st, eGroup);
  const slotDone = (st: CubieState) => cornersSolved(st, cGroup) && edgesSolved(st, eGroup);
  if (slotDone(s)) return [];

  const prevOk = (st: CubieState) => cornersSolved(st, prevC) && edgesSolved(st, prevE);

  // Phase A: get the target pieces out of the bottom two layers (or already home).
  const staged = (st: CubieState) => prevOk(st) &&
    (cornerAtU(st, slot.corner) || (st.cp[slot.corner] === slot.corner && st.co[slot.corner] === 0)) &&
    (cornersOnly || edgeAtU(st, slot.edge) || (st.ep[slot.edge] === slot.edge && st.eo[slot.edge] === 0));

  let cur = s;
  const path: string[] = [];
  if (!staged(cur)) {
    const a = searchPhase(cur, TRIGGERS.concat(uMoves), fullKey, staged, 4);
    if (a === null) { LAST_FAIL = 'extract'; return null; }
    path.push(...a);
    cur = applySeq(cur, a);
  }

  // Phase B: insert the pair using only this slot's triggers.
  const alphabet = uMoves.concat(slotMacros(slot.faces));
  const b = searchPhase(cur, alphabet, fullKey, slotDone, 5);
  if (b === null) { LAST_FAIL = 'insert'; return null; }
  path.push(...b);
  return path;
}

export function solve3x3(start: CubieState): string[] | null {
  LAST_FAIL = null;
  let s = cloneState(start);
  const sol: string[] = [];
  const push = (path: string[] | null) => { if (path && path.length) { sol.push(...path); s = applySeq(s, path); } };

  // 1. Cross on D, one edge at a time.
  const done: number[] = [];
  for (const e of CROSS_EDGES) {
    const group = done.concat([e]);
    const path = searchPhase(
      s, singleMoves,
      (st: CubieState) => edgeKeyPart(st, group),
      (st: CubieState) => edgesSolved(st, group),
      8,
    );
    if (path === null) { LAST_FAIL = 'cross'; return null; }
    push(path);
    done.push(e);
  }

  // 2. F2L, slot by slot.
  const solvedCorners: number[] = [], solvedEdges: number[] = CROSS_EDGES.slice();
  for (const slot of SLOTS) {
    const path = solveSlot(s, slot, solvedCorners, solvedEdges, false);
    if (path === null) return null;
    push(path);
    solvedCorners.push(slot.corner);
    solvedEdges.push(slot.edge);
  }

  const LLE = [0, 1, 2, 3], LLC = [0, 1, 2, 3];
  const llEdgeKey = (st: CubieState) => LLE.map((i: number) => { const p = st.ep.indexOf(i); return p + ':' + st.eo[p]; }).join(',');
  const llCornerKey = (st: CubieState) => LLC.map((i: number) => { const p = st.cp.indexOf(i); return p + ':' + st.co[p]; }).join(',');

  // 3. Orient last-layer edges.
  {
    const alphabet = uMoves.concat([{ seq: FSEXY }]);
    const path = searchPhase(
      s, alphabet,
      (st: CubieState) => llEdgeKey(st) + '|' + llCornerKey(st),
      (st: CubieState) => LLE.every((i: number) => st.eo[st.ep.indexOf(i)] === 0),
      8,
    );
    if (path === null) { LAST_FAIL = 'eo'; return null; }
    push(path);
  }

  // 4. Orient last-layer corners.
  {
    const alphabet = uMoves.concat([{ seq: SUNE }, { seq: ANTISUNE }]);
    const path = searchPhase(
      s, alphabet,
      (st: CubieState) => llCornerKey(st) + '|' + llEdgeKey(st),
      (st: CubieState) => LLC.every((i: number) => st.co[st.cp.indexOf(i)] === 0),
      10,
    );
    if (path === null) { LAST_FAIL = 'co'; return null; }
    push(path);
  }

  // 5. Permute last layer.
  {
    const alphabet = uMoves.concat([
      { seq: TPERM }, { seq: JPERM }, { seq: UPERM }, { seq: invertSeq(UPERM) },
    ]);
    const path = searchPhase(
      s, alphabet,
      (st: CubieState) => LLC.map((i: number) => st.cp.indexOf(i)).join('') + '|' + LLE.map((i: number) => st.ep.indexOf(i)).join(''),
      (st: CubieState) => isSolved(st),
      10,
    );
    if (path === null) { LAST_FAIL = 'pll'; return null; }
    push(path);
  }

  return cleanup(sol);
}

export function solve2x2(start: CubieState): string[] | null {
  LAST_FAIL = null;
  let s = cloneState(start);
  const sol: string[] = [];
  const push = (path: string[] | null) => { if (path && path.length) { sol.push(...path); s = applySeq(s, path); } };

  const solvedCorners: number[] = [];
  for (const slot of SLOTS) {
    const path = solveSlot(s, slot, solvedCorners, [], true);
    if (path === null) return null;
    push(path);
    solvedCorners.push(slot.corner);
  }

  const LLC = [0, 1, 2, 3];
  const llCornerKey = (st: CubieState) => LLC.map((i: number) => { const p = st.cp.indexOf(i); return p + ':' + st.co[p]; }).join(',');
  {
    const alphabet = uMoves.concat([{ seq: SUNE }, { seq: ANTISUNE }]);
    const path = searchPhase(
      s, alphabet, llCornerKey,
      (st: CubieState) => LLC.every((i: number) => st.co[st.cp.indexOf(i)] === 0),
      10,
    );
    if (path === null) { LAST_FAIL = '2x2-oll'; return null; }
    push(path);
  }
  {
    const alphabet = uMoves.concat([{ seq: TPERM }, { seq: JPERM }]);
    const path = searchPhase(
      s, alphabet,
      (st: CubieState) => LLC.map((i: number) => st.cp.indexOf(i)).join(''),
      (st: CubieState) => cornersSolved(st, [0, 1, 2, 3]),
      8,
    );
    if (path === null) { LAST_FAIL = '2x2-pll'; return null; }
    push(path);
  }
  return cleanup(sol);
}

export function isSolved(s: CubieState): boolean {
  for (let i = 0; i < 8; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 0; i < 12; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}
export function cornersOnlySolved(s: CubieState): boolean {
  for (let i = 0; i < 8; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  return true;
}

// Collapse consecutive same-face turns, drop no-ops.
function cleanup(seq: string[]): string[] {
  const out: { f: string; amt: number }[] = [];
  for (const m of seq) {
    const f = m[0];
    const amt = m.endsWith('2') ? 2 : m.endsWith("'") ? 3 : 1;
    if (out.length && out[out.length - 1].f === f) {
      out[out.length - 1].amt = (out[out.length - 1].amt + amt) % 4;
      if (out[out.length - 1].amt === 0) out.pop();
    } else {
      out.push({ f, amt });
    }
  }
  // second pass in case a removal merged neighbours
  const merged: { f: string; amt: number }[] = [];
  for (const t of out) {
    if (merged.length && merged[merged.length - 1].f === t.f) {
      merged[merged.length - 1].amt = (merged[merged.length - 1].amt + t.amt) % 4;
      if (merged[merged.length - 1].amt === 0) merged.pop();
    } else merged.push({ ...t });
  }
  return merged.map((t: { f: string; amt: number }) => t.f + (t.amt === 1 ? '' : t.amt === 2 ? '2' : "'"));
}

export function stateFromScramble(seq: string[]): CubieState | null {
  // Only plain face turns are modelled; wide turns are ignored (4x4+ unsupported).
  let s = cloneState(SOLVED);
  for (const m of seq) {
    if (!MOVES[m]) return null;
    s = applyMove(s, m);
  }
  return s;
}


export function lastFail(): string | null { return LAST_FAIL; }

// --- facelet projection (for cross-checking against the N x N model) -------

/** Facelet indices of each corner/edge piece, in the U R F D L B layout. */
const CORNER_FACELET = [[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]];
const EDGE_FACELET = [[5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
  [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]];

/** Project a cubie state onto 54 face-colour indices. */
export function toFacelets(state: CubieState): number[] {
  const f = new Array<number>(54);
  for (let i = 0; i < 54; i++) f[i] = Math.floor(i / 9);
  for (let c = 0; c < 8; c++) {
    const piece = state.cp[c], ori = state.co[c];
    for (let k = 0; k < 3; k++) {
      f[CORNER_FACELET[c][(k + ori) % 3]] = Math.floor(CORNER_FACELET[piece][k] / 9);
    }
  }
  for (let e = 0; e < 12; e++) {
    const piece = state.ep[e], ori = state.eo[e];
    for (let k = 0; k < 2; k++) {
      f[EDGE_FACELET[e][(k + ori) % 2]] = Math.floor(EDGE_FACELET[piece][k] / 9);
    }
  }
  return f;
}
