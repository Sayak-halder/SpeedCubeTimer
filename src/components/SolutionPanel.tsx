'use client';

import { useEffect, useState } from 'react';
import { fromAlg, applyAlg, isSolved as faceletSolved } from '@/lib/cube/facelet';
import { stateFromScramble, solve2x2, solve3x3 } from '@/lib/cube/cubie';

interface Result {
  moves: string[];
  verified: boolean;
}

export default function SolutionPanel({ size, scramble }: { size: number; scramble: string[] }) {
  const [result, setResult] = useState<Result | null>(null);
  const [working, setWorking] = useState(false);

  // A new scramble invalidates whatever was on screen.
  useEffect(() => {
    setResult(null);
    setWorking(false);
  }, [scramble, size]);

  if (size > 3) {
    return (
      <p className="note">
        Solutions cover the 2×2 and 3×3. Anything larger needs a reduction solver — group the
        centres, pair the edges, then handle the two parity cases that only appear on even cubes —
        which this app does not carry yet. Scrambles, timing and the 3D view work at every size.
      </p>
    );
  }

  const solve = () => {
    setWorking(true);
    // Let the button repaint before the search blocks the main thread.
    setTimeout(() => {
      const state = stateFromScramble(scramble);
      if (!state) {
        setResult(null);
        setWorking(false);
        return;
      }
      const moves = size === 2 ? solve2x2(state) : solve3x3(state);
      if (!moves) {
        setResult(null);
        setWorking(false);
        return;
      }
      // Replay in the facelet model, which knows nothing about the solver.
      const replay = fromAlg(size, scramble);
      applyAlg(replay, moves);
      setResult({ moves, verified: faceletSolved(replay) });
      setWorking(false);
    }, 0);
  };

  if (!result) {
    return (
      <div>
        <p className="note">
          Layer method: {size === 2 ? 'first layer, orient, permute' : 'cross, F2L, OLL, then PLL'}.
          Correct rather than short — a human-style route, not an optimal one.
        </p>
        <button type="button" className="btn primary" style={{ marginTop: 12 }} onClick={solve} disabled={working}>
          {working ? 'Searching…' : 'Solve this scramble'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="note">
        Hold the cube with white on the bottom and green in front, then run these from the
        scrambled state.
      </p>
      <div className="row" style={{ marginTop: 10 }}>
        <span className="badge">{result.moves.length} moves</span>
        <span className={`badge ${result.verified ? 'ok' : ''}`}>
          {result.verified ? 'verified solved' : 'verification failed'}
        </span>
        <button type="button" className="linkish" onClick={() => setResult(null)}>
          Clear
        </button>
      </div>
      <div className="solution-moves">{result.moves.join(' ')}</div>
    </div>
  );
}
