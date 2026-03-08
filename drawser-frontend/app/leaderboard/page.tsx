'use client';

import { useEffect, useState } from 'react';
import { Medal } from 'lucide-react';
import { AnimatedLayout } from '@/components/ui/AnimatedLayout';
import { GlassCard } from '@/components/ui/GlassCard';
import { getSupabaseClient } from '@/lib/supabase';

type LeaderboardRow = {
  id: string;
  username: string;
  total_score: number;
  games_played: number;
  wins: number;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase
      .from('profiles')
      .select('id, username, total_score, games_played, wins')
      .order('total_score', { ascending: false })
      .limit(100)
      .then(({ data, error: queryError }) => {
        if (queryError) {
          setError(queryError.message);
          return;
        }
        setRows((data || []) as LeaderboardRow[]);
      });
  }, []);

  return (
    <AnimatedLayout>
      <GlassCard className="p-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Global Leaderboard
        </h1>
        <p className="mt-1 text-sm text-white/70">Top 100 players by total score.</p>

        {error && <p className="mt-4 rounded-xl border border-red-300/30 bg-red-500/10 p-2 text-sm text-red-200">{error}</p>}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/15 text-white/60">
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Games</th>
                <th className="px-3 py-2">Wins</th>
                <th className="px-3 py-2">Win Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const winRate = row.games_played ? Math.round((row.wins / row.games_played) * 100) : 0;
                return (
                  <tr key={row.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-3 py-2 font-medium">
                      <span className="inline-flex items-center gap-1">
                        {index < 3 && <Medal className={`h-4 w-4 ${index === 0 ? 'text-yellow-300' : index === 1 ? 'text-zinc-200' : 'text-amber-600'}`} />}
                        #{index + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.username}</td>
                    <td className="px-3 py-2">{row.total_score}</td>
                    <td className="px-3 py-2">{row.games_played}</td>
                    <td className="px-3 py-2">{row.wins}</td>
                    <td className="px-3 py-2">{winRate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </AnimatedLayout>
  );
}
