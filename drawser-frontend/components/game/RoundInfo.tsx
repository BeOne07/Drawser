import { GlassCard } from '@/components/ui/GlassCard';

type RoundInfoProps = {
  round: number;
  totalRounds: number;
  timeLeft: number;
  hint: string;
};

export function RoundInfo({ round, totalRounds, timeLeft, hint }: RoundInfoProps) {
  const timerClass =
    timeLeft <= 10 ? 'text-red-300 animate-pulseSoft' : timeLeft <= 20 ? 'text-amber-300' : 'text-aqua';

  return (
    <GlassCard className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60">Round</p>
          <p className="text-lg font-semibold">
            {round} / {totalRounds}
          </p>
        </div>

        <div className="text-center">
          <p className="text-xs uppercase tracking-wide text-white/60">Hint</p>
          <p className="text-lg font-mono tracking-[0.25em] text-white">{hint || '_ _ _ _'}</p>
        </div>

        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-white/60">Time Left</p>
          <p className={`text-2xl font-bold ${timerClass}`}>{Math.max(0, Math.floor(timeLeft))}s</p>
        </div>
      </div>
    </GlassCard>
  );
}
