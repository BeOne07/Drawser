import Link from 'next/link';
import { Sparkles, Timer, Trophy } from 'lucide-react';
import { AnimatedLayout } from '@/components/ui/AnimatedLayout';
import { GlassCard } from '@/components/ui/GlassCard';

const features = [
  {
    title: 'Live Canvas Sync',
    description: 'Draw in real-time with low-latency Socket.IO broadcasts.',
    icon: Sparkles
  },
  {
    title: 'Timed Guessing Rounds',
    description: 'Hints roll out over time while scores reward fast guesses.',
    icon: Timer
  },
  {
    title: 'Persistent Leaderboard',
    description: 'Track global rankings and profile stats through Supabase.',
    icon: Trophy
  }
];

export default function HomePage() {
  return (
    <AnimatedLayout>
      <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <GlassCard className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-aqua/25 blur-3xl" />
          <p className="mb-3 inline-flex rounded-full border border-aqua/50 bg-aqua/10 px-3 py-1 text-xs font-medium text-aqua">
            Multiplayer Drawing Arena
          </p>
          <h1
            className="text-balance text-4xl font-bold leading-tight sm:text-5xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Sketch fast. Guess faster. Climb the Drawser ranks.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-white/75">
            Start a private room with friends or jump into a competitive guessing flow with animated rounds,
            live chat, and synced canvas tools.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/auth"
              className="rounded-xl bg-aqua px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-aqua/90"
            >
              Play Now
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
            >
              View Leaderboard
            </Link>
          </div>
        </GlassCard>

        <div className="glass flex items-center justify-center rounded-2xl border border-white/10 p-6">
          <div className="grid h-full w-full grid-cols-6 grid-rows-6 gap-2 rounded-xl border border-white/10 bg-slateNight/70 p-2">
            {Array.from({ length: 36 }).map((_, idx) => (
              <div
                key={idx}
                className={`rounded ${idx % 5 === 0 ? 'bg-ember/70' : idx % 3 === 0 ? 'bg-aqua/70' : 'bg-white/10'}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {features.map((feature, index) => (
          <GlassCard key={feature.title} className="animate-riseIn" style={{ animationDelay: `${index * 80}ms` }}>
            <feature.icon className="mb-4 h-5 w-5 text-aqua" />
            <h2 className="text-lg font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm text-white/75">{feature.description}</p>
          </GlassCard>
        ))}
      </section>
    </AnimatedLayout>
  );
}
