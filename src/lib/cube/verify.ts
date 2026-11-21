/**
 * Checks for the two cube models. Run with:
 *   node --experimental-strip-types src/lib/cube/verify.ts
 *
 * The important one is `crossCheck`: the N x N facelet model and the 3x3 cubie
 * model are built from completely different primitives (sticker cycling versus
 * piece permutation plus orientation), so if their 54 facelets agree after
 * thousands of random sequences, both are almost certainly right.
 */

import {
  solved, clone, isSolved as faceletSolved, applyAlg, fromAlg, invertAlg,
  turn, parseMove, FACE_LETTER,
} from './facelet';
import {
  stateFromScramble, applySeq, solve3x3, solve2x2, isSolved as cubieSolved,
  cornersOnlySolved, toFacelets, cloneState,
} from './cubie';
import { scramble } from './scramble';

let failures = 0;
function check(cond: boolean, msg: string): void {
  if (!cond) {
    failures++;
    console.error('  FAIL: ' + msg);
  }
}

function randomAlg(n: number, len: number): string[] {
  const out: string[] = [];
  const maxSpan = n >= 4 ? Math.floor(n / 2) : 1;
  for (let i = 0; i < len; i++) {
    const letter = FACE_LETTER[Math.floor(Math.random() * 6)];
    let token: string = letter;
    if (maxSpan > 1) {
      const span = 1 + Math.floor(Math.random() * maxSpan);
      if (span === 2) token += 'w';
      else if (span > 2) token = span + token + 'w';
    }
    token += ['', '2', "'"][Math.floor(Math.random() * 3)];
    out.push(token);
  }
  return out;
}

// 1. Every quarter turn has order four, at every size and depth.
console.log('order-four turns');
for (let n = 2; n <= 7; n++) {
  for (let face = 0; face < 6; face++) {
    for (let depth = 0; depth < n; depth++) {
      const c = solved(n);
      for (let k = 0; k < 4; k++) turn(c, face, [depth], 1);
      check(faceletSolved(c), `${FACE_LETTER[face]} depth ${depth} on ${n}x${n} has order 4`);
    }
  }
}

// 2. An algorithm followed by its inverse is the identity.
console.log('inverse algorithms');
for (let n = 2; n <= 7; n++) {
  for (let t = 0; t < 40; t++) {
    const alg = randomAlg(n, 25);
    const c = fromAlg(n, alg);
    applyAlg(c, invertAlg(alg));
    check(faceletSolved(c), `${n}x${n} alg then inverse returns to solved`);
  }
}

// 3. Wide turns equal the product of their layers.
console.log('wide turns');
for (let n = 4; n <= 7; n++) {
  for (let face = 0; face < 6; face++) {
    for (let span = 2; span <= Math.floor(n / 2); span++) {
      const token = (span === 2 ? '' : String(span)) + FACE_LETTER[face] + 'w';
      const a = solved(n);
      applyAlg(a, [token]);
      const b = solved(n);
      const depths: number[] = [];
      for (let d = 0; d < span; d++) depths.push(d);
      turn(b, face, depths, 1);
      check(a.f.every((v, i) => v === b.f[i]), `${token} on ${n}x${n} equals its layers`);
      check(parseMove(token) !== null, `${token} parses`);
    }
  }
}

// 4. The two models agree on the 3x3.
console.log('cross-check: facelet model vs cubie model');
for (let t = 0; t < 3000; t++) {
  const alg = randomAlg(3, 20);
  const a = fromAlg(3, alg);
  const cubie = stateFromScramble(alg);
  if (!cubie) {
    check(false, 'cubie model parsed the algorithm');
    break;
  }
  const b = toFacelets(cubie);
  if (!a.f.every((v, i) => v === b[i])) {
    check(false, `models disagree on: ${alg.join(' ')}`);
    break;
  }
}

// 5. The solver still solves, and its solutions replay in the facelet model.
console.log('solver');
for (const size of [2, 3]) {
  let worst = 0, total = 0;
  const trials = 400;
  const started = Date.now();
  for (let t = 0; t < trials; t++) {
    const alg = scramble(size);
    const state = stateFromScramble(alg);
    if (!state) { check(false, 'scramble parsed'); break; }
    const solution = size === 2 ? solve2x2(cloneState(state)) : solve3x3(cloneState(state));
    if (!solution) { check(false, `no solution for ${alg.join(' ')}`); continue; }
    const end = applySeq(state, solution);
    const ok = size === 2 ? cornersOnlySolved(end) : cubieSolved(end);
    check(ok, `cubie model: solution solves ${alg.join(' ')}`);
    // replay the same solution in the independent facelet model
    const fc = fromAlg(size === 2 ? 2 : 3, alg);
    applyAlg(fc, solution);
    check(faceletSolved(fc), `facelet model: solution solves ${alg.join(' ')}`);
    total += solution.length;
    worst = Math.max(worst, solution.length);
  }
  console.log(`  ${size}x${size}: avg ${(total / trials).toFixed(1)} moves, worst ${worst}, ` +
    `${((Date.now() - started) / trials).toFixed(1)} ms/solve`);
}

// 6. A scramble of each size is parseable and actually scrambles.
console.log('scrambles');
for (let n = 2; n <= 7; n++) {
  const alg = scramble(n);
  check(alg.every((t) => parseMove(t) !== null), `${n}x${n} scramble tokens all parse`);
  check(!faceletSolved(fromAlg(n, alg)), `${n}x${n} scramble leaves the cube scrambled`);
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
if (failures > 0) process.exit(1);
