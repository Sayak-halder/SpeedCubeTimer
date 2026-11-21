'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PASSWORD_MIN, emailProblem, passwordProblem } from '@/lib/validate';

type Mode = 'signin' | 'register';

export default function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    // Check locally first, so an obvious slip costs no round trip.
    const problem = emailProblem(email.trim().toLowerCase())
      ?? (mode === 'register' ? passwordProblem(password) : password ? null : 'Enter your password.');
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          if (response.status === 409) {
            setError('That address cannot be registered. If the account is yours, sign in instead.');
          } else {
            setError(data.error ?? 'Could not create the account.');
          }
          setBusy(false);
          return;
        }
      }

      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) {
        setError('That email and password do not match an account.');
        setBusy(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError('Something went wrong. Try again.');
      setBusy(false);
    }
  };

  return (
    <>
      <header className="top">
        <h1>Speedcube <span>Timer</span></h1>
      </header>

      <form className="plate" onSubmit={submit} style={{ gap: 14 }}>
        <div className="plate-head">
          <span>{mode === 'signin' ? 'Sign in' : 'Create an account'}</span>
        </div>

        {mode === 'register' ? (
          <label className="field">
            <span>Name on the leaderboard</span>
            <input
              id="auth-name"
              type="text"
              value={name}
              autoComplete="nickname"
              placeholder="Optional"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        ) : null}

        <label className="field">
          <span>Email</span>
          <input
            id="auth-email"
            type="email"
            value={email}
            required
            autoComplete="email"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            id="auth-password"
            type="password"
            value={password}
            required
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === 'register' ? (
            <small className="note">At least {PASSWORD_MIN} characters. Length is what matters.</small>
          ) : null}
        </label>

        {error ? <p className="note dnf" role="alert">{error}</p> : null}

        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        <button
          type="button"
          className="linkish"
          onClick={() => {
            setMode(mode === 'signin' ? 'register' : 'signin');
            setError(null);
          }}
        >
          {mode === 'signin' ? 'Need an account?' : 'Already have an account?'}
        </button>
      </form>

      <p className="note">
        There is no password reset yet — it needs an email provider wired up. Until then a
        forgotten password means a new account.
      </p>

      <a className="linkish" href="/">Back to the timer</a>
    </>
  );
}
