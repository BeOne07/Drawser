'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatedLayout } from '@/components/ui/AnimatedLayout';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/components/providers/AuthProvider';
import { ensureUserProfile } from '@/lib/profileSync';
import { getSupabaseClient } from '@/lib/supabase';

type ProfileRow = {
  username: string;
  avatar_url: string | null;
  total_score: number;
  games_played: number;
  wins: number;
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user) return;
    const supabase = getSupabaseClient();
    ensureUserProfile(supabase, user)
      .then((data) => {
        setProfile(data as ProfileRow);
      })
      .catch((queryError) => {
        setError(queryError instanceof Error ? queryError.message : 'Failed to load profile.');
      });
  }, [user]);

  const winRate = useMemo(() => {
    if (!profile || !profile.games_played) return 0;
    return Math.round((profile.wins / profile.games_played) * 100);
  }, [profile]);

  if (loading || !user) {
    return (
      <AnimatedLayout>
        <GlassCard>Loading profile...</GlassCard>
      </AnimatedLayout>
    );
  }

  return (
    <AnimatedLayout>
      <GlassCard className="p-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Profile
        </h1>

        {error && <p className="mt-4 rounded-xl border border-red-300/30 bg-red-500/10 p-2 text-sm text-red-200">{error}</p>}

        {profile && (
          <div className="mt-5">
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-slate-900 text-xl">
                {profile.username[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-lg font-semibold">{profile.username}</p>
                <p className="text-sm text-white/60">{user.email}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Score" value={profile.total_score} />
              <StatCard label="Games Played" value={profile.games_played} />
              <StatCard label="Wins" value={profile.wins} />
              <StatCard label="Win Rate" value={`${winRate}%`} />
            </div>
          </div>
        )}
      </GlassCard>
    </AnimatedLayout>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-wide text-white/60">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
