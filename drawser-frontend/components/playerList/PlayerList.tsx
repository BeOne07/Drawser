import { Crown, Pencil, Check } from 'lucide-react';
import { Player } from '@/lib/socket';
import { GlassCard } from '@/components/ui/GlassCard';

type PlayerListProps = {
  players: Player[];
  currentDrawerId: string | null;
};

export function PlayerList({ players, currentDrawerId }: PlayerListProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <GlassCard className="h-full p-4">
      <h3 className="mb-3 text-sm uppercase tracking-wide text-white/70">Players</h3>
      <ul className="space-y-2">
        {sorted.map((player) => (
          <li key={player.socketId} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{player.username}</p>
                <p className="text-xs text-white/60">{player.score} pts</p>
              </div>
              <div className="flex items-center gap-1">
                {player.isHost && <Crown className="h-4 w-4 text-amber-300" />}
                {player.socketId === currentDrawerId && <Pencil className="h-4 w-4 text-aqua" />}
                {player.hasGuessed && <Check className="h-4 w-4 text-moss" />}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
