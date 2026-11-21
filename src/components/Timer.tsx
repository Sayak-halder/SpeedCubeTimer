'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatMs } from '@/lib/stats';

type Phase = 'idle' | 'inspecting' | 'holding' | 'armed' | 'running';

const HOLD_MS = 350;
const INSPECTION_MS = 15_000;

export interface TimerProps {
  /** Called with the raw time once a solve finishes. */
  onSolve: (ms: number) => void;
  /** Called when inspection overruns 17 seconds, which is a DNF under WCA rules. */
  onInspectionDnf: () => void;
  inspection: boolean;
  disabled?: boolean;
}

export default function Timer({ onSolve, onInspectionDnf, inspection, disabled }: TimerProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [display, setDisplay] = useState('0.00');
  const [hint, setHint] = useState('Hold space — or press and hold here — then release');

  const phaseRef = useRef<Phase>('idle');
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const startedAt = useRef(0);
  const inspectionStart = useRef(0);

  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const clearTimers = useCallback(() => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (frame.current) { cancelAnimationFrame(frame.current); frame.current = null; }
  }, []);

  const runClock = useCallback(() => {
    const tick = () => {
      setDisplay(formatMs(Date.now() - startedAt.current));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, []);

  const runInspection = useCallback(() => {
    const tick = () => {
      const elapsed = Date.now() - inspectionStart.current;
      const left = INSPECTION_MS - elapsed;
      if (elapsed > 17_000) {
        clearTimers();
        setPhaseBoth('idle');
        setDisplay('DNF');
        setHint('Inspection ran past 17 seconds');
        onInspectionDnf();
        return;
      }
      setDisplay(left > 0 ? String(Math.ceil(left / 1000)) : `+2 (${Math.ceil((17_000 - elapsed) / 1000)})`);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [clearTimers, onInspectionDnf, setPhaseBoth]);

  const stop = useCallback(() => {
    if (phaseRef.current !== 'running') return;
    clearTimers();
    const ms = Date.now() - startedAt.current;
    setPhaseBoth('idle');
    setDisplay(formatMs(ms));
    setHint('Hold space — or press and hold here — then release');
    onSolve(ms);
  }, [clearTimers, onSolve, setPhaseBoth]);

  const beginHold = useCallback(() => {
    if (disabled) return;
    const current = phaseRef.current;

    if (current === 'idle' && inspection) {
      inspectionStart.current = Date.now();
      setPhaseBoth('inspecting');
      setHint('Inspecting — hold again when you are ready');
      runInspection();
      return;
    }
    if (current !== 'idle' && current !== 'inspecting') return;

    if (current === 'inspecting' && frame.current) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    setPhaseBoth('holding');
    if (current !== 'inspecting') setDisplay('0.00');
    setHint('Keep holding…');
    holdTimer.current = setTimeout(() => {
      if (phaseRef.current === 'holding') {
        setPhaseBoth('armed');
        setHint('Release to start');
      }
    }, HOLD_MS);
  }, [disabled, inspection, runInspection, setPhaseBoth]);

  const endHold = useCallback(() => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    const current = phaseRef.current;
    if (current === 'armed') {
      startedAt.current = Date.now();
      setPhaseBoth('running');
      setHint('Press anything to stop');
      runClock();
    } else if (current === 'holding') {
      setPhaseBoth('idle');
      setDisplay('0.00');
      setHint('Held too briefly — keep holding until it turns green');
    }
  }, [runClock, setPhaseBoth]);

  // Keyboard: space arms and starts, any key stops.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (phaseRef.current === 'running') { e.preventDefault(); stop(); return; }
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) beginHold(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); endHold(); }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [beginHold, endHold, stop]);

  useEffect(() => clearTimers, [clearTimers]);

  const tone = phase === 'armed' ? 'armed' : phase === 'holding' ? 'holding' : phase === 'inspecting' ? 'inspect' : '';

  return (
    <section
      className={`face ${tone}`}
      tabIndex={0}
      role="button"
      aria-label="Hold to start the timer"
      onPointerDown={(e) => {
        e.preventDefault();
        if (phaseRef.current === 'running') stop();
        else beginHold();
      }}
      onPointerUp={(e) => { e.preventDefault(); endHold(); }}
      onPointerCancel={() => {
        if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
        if (phaseRef.current === 'holding' || phaseRef.current === 'armed') {
          setPhaseBoth('idle');
          setHint('Hold space — or press and hold here — then release');
        }
      }}
    >
      <div className={`clock ${tone}`}>{display}</div>
      <div className="hint">{hint}</div>
    </section>
  );
}
