'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { fromAlg } from '@/lib/cube/facelet';
import { scramble as makeScramble, SIZES } from '@/lib/cube/scramble';
import { averageOf, bestAverage, bestSingle, formatMs, type Penalty, type Solve } from '@/lib/stats';
import CubeView from './CubeView';
import Timer from './Timer';
import SolutionPanel from './SolutionPanel';
import Leaderboard from './Leaderboard';

type Tab = 'session' | 'board' | 'solution';

const LOCAL_KEY = 'cube.solves.v1';

/**
 * The first render uses a fixed scramble so the server and the client produce
 * the same markup and the page paints a real cube straight away. A random one
 * replaces it on mount.
 */
const SEED_SCRAMBLE = "D2 F2 U' R2 U B2 L2 D' B2 L' B' U R' F2 D L' U2 R F'".split(' ');

function readLocal(): Record<number, Solve[]> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLocal(data: Record<number, Solve[]>) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable; the session simply will not survive a reload */
  }
}

export default function TimerApp() {
  const { data: session, status } = useSession();
  const signedIn = status === 'authenticated';
  const myId = session?.user?.id;

  const [size, setSize] = useState(3);
  // Scrambles are random, so they are generated after mount. Generating one
  // during render would produce different markup on the server and the client
  // and break hydration.
  const [scramble, setScramble] = useState<string[]>(SEED_SCRAMBLE);
  const [seeded, setSeeded] = useState(false);
  const [solves, setSolves] = useState<Solve[]>([]); // newest first
  const [tab, setTab] = useState<Tab>('session');
  const [inspection, setInspection] = useState(false);
  const [boardKey, setBoardKey] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const localCache = useRef<Record<number, Solve[]>>({});

  const cube = useMemo(() => fromAlg(size, scramble), [size, scramble]);

  const nextScramble = useCallback((n: number) => setScramble(makeScramble(n)), []);

  useEffect(() => {
    setScramble(makeScramble(3));
    setSeeded(true);
  }, []);

  // Load solves for the current size: from the server when signed in,
  // from this browser otherwise.
  useEffect(() => {
    let cancelled = false;
    if (signedIn) {
      fetch(`/api/solves?size=${size}`)
        .then((r) => (r.ok ? r.json() : { solves: [] }))
        .then((data) => {
          if (!cancelled) setSolves(data.solves ?? []);
        })
        .catch(() => {
          if (!cancelled) setSolves([]);
        });
    } else {
      localCache.current = readLocal();
      setSolves(localCache.current[size] ?? []);
    }
    return () => {
      cancelled = true;
    };
  }, [size, signedIn]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cube.inspection');
      if (saved === '1') setInspection(true);
    } catch {
      /* ignore */
    }
  }, []);

  const persistLocal = useCallback((next: Solve[], forSize: number) => {
    localCache.current = { ...localCache.current, [forSize]: next.slice(0, 500) };
    writeLocal(localCache.current);
  }, []);

  const addSolve = useCallback(
    (ms: number, penalty: Penalty = 'OK') => {
      const optimistic: Solve = {
        id: `local-${Date.now()}`,
        ms,
        penalty,
        scramble: scramble.join(' '),
        createdAt: new Date().toISOString(),
        local: true,
      };
      const currentSize = size;
      setSolves((prev) => {
        const next = [optimistic, ...prev];
        if (!signedIn) persistLocal(next, currentSize);
        return next;
      });
      nextScramble(currentSize);

      if (!signedIn) return;
      fetch('/api/solves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: currentSize, ms, penalty, scramble: optimistic.scramble }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data) => {
          setSolves((prev) => prev.map((s) => (s.id === optimistic.id ? { ...data.solve, local: false } : s)));
          setSaveError(null);
          setBoardKey((k) => k + 1);
        })
        .catch(() => setSaveError('That solve is on screen but was not saved to your account.'));
    },
    [nextScramble, persistLocal, scramble, signedIn, size],
  );

  const updateLast = useCallback(
    (action: Penalty | 'remove') => {
      const last = solves[0];
      if (!last) return;
      const currentSize = size;

      setSolves((prev) => {
        const next = action === 'remove'
          ? prev.slice(1)
          : prev.map((s, i) => (i === 0 ? { ...s, penalty: action } : s));
        if (!signedIn) persistLocal(next, currentSize);
        return next;
      });

      if (!signedIn || last.local) return;
      fetch('/api/solves', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'remove' ? { id: last.id, remove: true } : { id: last.id, penalty: action },
        ),
      })
        .then(() => setBoardKey((k) => k + 1))
        .catch(() => setSaveError('That change did not reach your account.'));
    },
    [persistLocal, signedIn, size, solves],
  );

  const stats = useMemo(
    () => ({
      count: solves.length,
      best: bestSingle(solves),
      ao5: averageOf(solves, 5),
      ao12: averageOf(solves, 12),
      bestAo5: bestAverage(solves, 5),
    }),
    [solves],
  );

  const toggleInspection = () => {
    setInspection((v) => {
      const next = !v;
      try {
        localStorage.setItem('cube.inspection', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="wrap">
      <header className="top">
        <h1>Speedcube <span>Timer</span></h1>
        <div className="row">
          {signedIn ? (
            <>
              <span className="who">{session?.user?.name ?? 'signed in'}</span>
              <button type="button" className="btn" onClick={() => signOut()}>Sign out</button>
            </>
          ) : (
            <Link className="btn primary" href="/signin">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <div className="row" role="group" aria-label="Cube size">
        {SIZES.map((n) => (
          <button
            key={n}
            type="button"
            className="btn mono"
            aria-pressed={n === size}
            onClick={() => {
              setSize(n);
              nextScramble(n);
            }}
          >
            {n}×{n}
          </button>
        ))}
        <button
          type="button"
          className="btn"
          aria-pressed={inspection}
          onClick={toggleInspection}
          style={{ marginLeft: 'auto' }}
        >
          15s inspection
        </button>
      </div>

      <section className="plate">
        <div className="plate-head">
          <span>Scramble · {size}×{size}</span>
          <button type="button" className="linkish" onClick={() => nextScramble(size)}>
            New scramble
          </button>
        </div>
        <div className="scramble-text">{scramble.join(' ')}</div>
      </section>

      <CubeView cube={cube} />

      <Timer
        inspection={inspection}
        disabled={!seeded}
        onSolve={(ms) => addSolve(ms)}
        onInspectionDnf={() => addSolve(0, 'DNF')}
      />

      {solves.length > 0 ? (
        <div className="row" style={{ justifyContent: 'center' }}>
          <span className="note">Last solve:</span>
          <button type="button" className="btn" onClick={() => updateLast('OK')}>OK</button>
          <button type="button" className="btn" onClick={() => updateLast('PLUS2')}>+2</button>
          <button type="button" className="btn" onClick={() => updateLast('DNF')}>DNF</button>
          <button type="button" className="btn" onClick={() => updateLast('remove')}>Delete</button>
        </div>
      ) : null}

      {saveError ? <p className="note dnf">{saveError}</p> : null}
      {!signedIn && status !== 'loading' ? (
        <p className="note">
          Times are kept in this browser. <Link href="/signin">Sign in</Link> to keep them with
          your account and appear on the board.
        </p>
      ) : null}

      <dl className="rail">
        <div className="stat"><dt>Solves</dt><dd>{stats.count}</dd></div>
        <div className="stat"><dt>Best</dt><dd>{formatMs(stats.best)}</dd></div>
        <div className="stat"><dt>Ao5</dt><dd>{formatMs(stats.ao5)}</dd></div>
        <div className="stat"><dt>Ao12</dt><dd>{formatMs(stats.ao12)}</dd></div>
        <div className="stat"><dt>Best Ao5</dt><dd>{formatMs(stats.bestAo5)}</dd></div>
      </dl>

      <div>
        <div className="tabs" role="tablist">
          {([['session', 'Session'], ['board', 'Leaderboard'], ['solution', 'Solution']] as const).map(
            ([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                className="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ),
          )}
        </div>

        <div className="panel-body">
          {tab === 'session' ? (
            solves.length === 0 ? (
              <p className="empty">No solves yet for the {size}×{size}. Hold space, release, and go.</p>
            ) : (
              <div className="scroll-x">
                <table>
                  <thead>
                    <tr><th>#</th><th>Time</th><th>Scramble</th></tr>
                  </thead>
                  <tbody>
                    {solves.slice(0, 50).map((s, i) => (
                      <tr key={s.id}>
                        <td className="rank">{solves.length - i}</td>
                        <td className={`mono ${s.penalty === 'DNF' ? 'dnf' : s.penalty === 'PLUS2' ? 'plus2' : ''}`}>
                          {s.penalty === 'DNF' ? 'DNF' : formatMs(s.ms + (s.penalty === 'PLUS2' ? 2000 : 0))}
                          {s.penalty === 'PLUS2' ? ' (+2)' : ''}
                        </td>
                        <td className="mono" style={{ color: 'var(--ink-faint)', fontSize: 11 }}>
                          {s.scramble}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          {tab === 'board' ? <Leaderboard size={size} myId={myId} refreshKey={boardKey} /> : null}
          {tab === 'solution' ? <SolutionPanel size={size} scramble={scramble} /> : null}
        </div>
      </div>
    </div>
  );
}
