'use client';

import { useEffect, useState } from 'react';
import { formatMs } from '@/lib/stats';

interface Entry {
  userId: string;
  name: string;
  image: string | null;
  bestMs: number | null;
  solveCount: number;
}

export default function Leaderboard({ size, myId, refreshKey }: { size: number; myId?: string; refreshKey: number }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    fetch(`/api/leaderboard?size=${size}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (!cancelled) setEntries(data.entries ?? []);
      })
      .catch(() => {
        if (!cancelled) setError('The board could not be loaded. It may just need a refresh.');
      });
    return () => {
      cancelled = true;
    };
  }, [size, refreshKey]);

  if (error) return <p className="empty">{error}</p>;
  if (entries === null) return <p className="empty">Loading the board…</p>;
  if (entries.length === 0) {
    return <p className="empty">No times posted for the {size}×{size} yet. Sign in, finish a solve, and yours goes up.</p>;
  }

  return (
    <div className="scroll-x">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Cuber</th>
            <th>Best single</th>
            <th>Solves</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr key={entry.userId} className={entry.userId === myId ? 'me' : undefined}>
              <td className="rank">{i + 1}</td>
              <td>
                {entry.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="avatar" src={entry.image} alt="" width={22} height={22} />
                ) : null}
                {entry.name}
              </td>
              <td className="mono">{formatMs(entry.bestMs)}</td>
              <td className="mono">{entry.solveCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
