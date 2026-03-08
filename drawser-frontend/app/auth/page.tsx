'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AnimatedLayout } from '@/components/ui/AnimatedLayout';
import { GlassCard } from '@/components/ui/GlassCard';
import { getSupabaseClient } from '@/lib/supabase';
import { ensureUserProfile } from '@/lib/profileSync';

type Mode = 'signin' | 'signup';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const title = useMemo(
    () => (mode === 'signin' ? 'Welcome Back' : 'Create Drawser Account'),
    [mode]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);

    const supabase = getSupabaseClient();

    try {
      if (mode === 'signin') {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        if (signInData.user) {
          await ensureUserProfile(supabase, signInData.user);
        }
        router.push('/lobby');
        router.refresh();
        return;
      }

      const desiredUsername = username.trim() || email.split('@')[0];
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: desiredUsername
          }
        }
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.user) {
        await ensureUserProfile(supabase, data.user, desiredUsername);
      }

      if (data.session) {
        router.push('/lobby');
        router.refresh();
      } else {
        setInfo('Account created. Check your inbox if email confirmation is required.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatedLayout>
      <div className="mx-auto w-full max-w-lg">
        <GlassCard className="p-8">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              {title}
            </h1>
            <div className="rounded-xl border border-white/10 bg-white/5 p-1 text-xs">
              <button
                onClick={() => setMode('signin')}
                className={`rounded-lg px-3 py-1.5 transition ${
                  mode === 'signin' ? 'bg-aqua text-slate-900' : 'text-white/80'
                }`}
              >
                Sign in
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`rounded-lg px-3 py-1.5 transition ${
                  mode === 'signup' ? 'bg-ember text-slate-900' : 'text-white/80'
                }`}
              >
                Sign up
              </button>
            </div>
          </div>

          <motion.form
            key={mode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            onSubmit={onSubmit}
            className="space-y-4"
          >
            {mode === 'signup' && (
              <div>
                <label className="mb-1 block text-sm text-white/70">Username</label>
                <input
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slateNight/80 px-3 py-2 outline-none ring-aqua/50 focus:ring-2"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm text-white/70">Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slateNight/80 px-3 py-2 outline-none ring-aqua/50 focus:ring-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-white/70">Password</label>
              <input
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-white/15 bg-slateNight/80 px-3 py-2 outline-none ring-aqua/50 focus:ring-2"
              />
            </div>

            {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-2 text-sm text-red-200">{error}</p>}
            {info && <p className="rounded-xl border border-aqua/30 bg-aqua/10 p-2 text-sm text-aqua">{info}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-aqua px-4 py-2.5 font-semibold text-slate-900 transition hover:bg-aqua/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </motion.form>
        </GlassCard>
      </div>
    </AnimatedLayout>
  );
}
