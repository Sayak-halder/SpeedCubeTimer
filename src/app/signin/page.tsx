import { Suspense } from 'react';
import AuthForm from '@/components/AuthForm';

export const metadata = { title: 'Sign in · Speedcube Timer' };

export default function SignInPage() {
  return (
    <div className="wrap" style={{ maxWidth: 420 }}>
      <Suspense fallback={<p className="empty">Loading…</p>}>
        <AuthForm />
      </Suspense>
    </div>
  );
}
