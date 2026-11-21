'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { faceGrid, U, R, F, D, L, B, type Cube } from '@/lib/cube/facelet';

const STICKER_VAR = [
  'var(--sticker-u)',
  'var(--sticker-r)',
  'var(--sticker-f)',
  'var(--sticker-d)',
  'var(--sticker-l)',
  'var(--sticker-b)',
];

/**
 * Each face is placed by rotating it into position and pushing it out by half
 * the cube's width. The rotations are chosen so that each face's grid, read
 * from outside, matches the row/column convention in `facelet.ts` — row 0 of U
 * at the back, row 0 of D at the front, and so on.
 */
const FACE_TRANSFORM: Record<number, string> = {
  [U]: 'rotateX(90deg)',
  [D]: 'rotateX(-90deg)',
  [F]: '',
  [B]: 'rotateY(180deg)',
  [R]: 'rotateY(90deg)',
  [L]: 'rotateY(-90deg)',
};

function Face({ cube, face, cell }: { cube: Cube; face: number; cell: number }) {
  const grid = faceGrid(cube, face);
  return (
    <>
      {grid.flatMap((row, r) =>
        row.map((colour, c) => (
          <div
            key={`${r}-${c}`}
            className="sticker"
            style={{ width: cell, height: cell, background: STICKER_VAR[colour] }}
          />
        )),
      )}
    </>
  );
}

export function CubeNet({ cube }: { cube: Cube }) {
  const n = cube.n;
  const cell = Math.max(8, Math.round(78 / n));
  const faceStyle = { gridTemplateColumns: `repeat(${n}, ${cell}px)` };

  const cells: Array<{ face: number | null; key: string }> = [
    { face: null, key: 'a' }, { face: U, key: 'u' }, { face: null, key: 'b' }, { face: null, key: 'c' },
    { face: L, key: 'l' }, { face: F, key: 'f' }, { face: R, key: 'r' }, { face: B, key: 'bk' },
    { face: null, key: 'd1' }, { face: D, key: 'd' }, { face: null, key: 'd2' }, { face: null, key: 'd3' },
  ];

  return (
    <div className="net" style={{ gridTemplateColumns: 'repeat(4, max-content)' }}>
      {cells.map(({ face, key }) =>
        face === null ? (
          <div key={key} className="net-blank" />
        ) : (
          <div key={key} className="net-face" style={faceStyle}>
            <Face cube={cube} face={face} cell={cell} />
          </div>
        ),
      )}
    </div>
  );
}

export function Cube3D({ cube }: { cube: Cube }) {
  const n = cube.n;
  const cell = Math.max(13, Math.round(150 / n));
  const faceSize = n * cell + (n - 1) * 2 + 4;
  const half = faceSize / 2;

  const [angle, setAngle] = useState({ x: -24, y: -34 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setAngle((a) => ({
      x: Math.max(-89, Math.min(89, a.x - dy * 0.5)),
      y: a.y + dx * 0.5,
    }));
  }, []);

  const endDrag = useCallback(() => {
    drag.current = null;
  }, []);

  // Keyboard nudging, so the view is reachable without a pointer.
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = 12;
    if (e.key === 'ArrowLeft') setAngle((a) => ({ ...a, y: a.y - step }));
    else if (e.key === 'ArrowRight') setAngle((a) => ({ ...a, y: a.y + step }));
    else if (e.key === 'ArrowUp') setAngle((a) => ({ ...a, x: Math.min(89, a.x + step) }));
    else if (e.key === 'ArrowDown') setAngle((a) => ({ ...a, x: Math.max(-89, a.x - step) }));
    else return;
    e.preventDefault();
  }, []);

  return (
    <div
      className="cube-stage"
      style={{ minHeight: faceSize * 1.5 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="img"
      aria-label={`Scrambled ${n} by ${n} cube. Drag or use arrow keys to turn it.`}
    >
      <div
        className="cube-3d"
        style={{
          width: faceSize,
          height: faceSize,
          transform: `rotateX(${angle.x}deg) rotateY(${angle.y}deg)`,
        }}
      >
        {[U, R, F, D, L, B].map((face) => (
          <div
            key={face}
            className="cube-face"
            style={{
              width: faceSize,
              height: faceSize,
              gridTemplateColumns: `repeat(${n}, ${cell}px)`,
              transform: `${FACE_TRANSFORM[face]} translateZ(${half}px)`,
            }}
          >
            <Face cube={cube} face={face} cell={cell} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CubeView({ cube }: { cube: Cube }) {
  const [mode, setMode] = useState<'3d' | 'net'>('3d');

  // Keep the mode across reloads; harmless if storage is unavailable.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cube.view');
      if (saved === '3d' || saved === 'net') setMode(saved);
    } catch {
      /* no storage, keep the default */
    }
  }, []);

  const choose = (next: '3d' | 'net') => {
    setMode(next);
    try {
      localStorage.setItem('cube.view', next);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="plate">
      <div className="plate-head">
        <span>Scrambled state</span>
        <div className="row">
          <button
            type="button"
            className="btn"
            aria-pressed={mode === '3d'}
            onClick={() => choose('3d')}
          >
            3D
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={mode === 'net'}
            onClick={() => choose('net')}
          >
            Net
          </button>
        </div>
      </div>
      {mode === '3d' ? (
        <Cube3D cube={cube} />
      ) : (
        <div className="scroll-x">
          <CubeNet cube={cube} />
        </div>
      )}
    </div>
  );
}
