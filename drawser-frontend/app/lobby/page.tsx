'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Plus, Users } from 'lucide-react';
import { AnimatedLayout } from '@/components/ui/AnimatedLayout';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth } from '@/components/providers/AuthProvider';
import { getSocket, RoomPayload } from '@/lib/socket';
import { ensureUserProfile } from '@/lib/profileSync';
import { getSupabaseClient } from '@/lib/supabase';

const defaultSettings = {
  maxPlayers: 8,
  rounds: 3,
  drawTime: 80,
  difficulty: 'mixed' as const,
  hints: 2
};

export default function LobbyPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeRoomId, setActiveRoomId] = useState('');
  const [room, setRoom] = useState<RoomPayload | null>(null);
  const [username, setUsername] = useState('');
  const [settings, setSettings] = useState(defaultSettings);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const inviteUrl = useMemo(() => {
    if (!activeRoomId) return '';
    if (typeof window === 'undefined') return activeRoomId;
    return `${window.location.origin}/game/${activeRoomId}`;
  }, [activeRoomId]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user) return;
    const supabase = getSupabaseClient();
    ensureUserProfile(supabase, user)
      .then((profile) => {
        setUsername(profile.username || user.email?.split('@')[0] || 'player');
      })
      .catch((profileError) => {
        console.error('Lobby profile sync failed:', profileError);
        setUsername(user.email?.split('@')[0] || 'player');
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    if (!socket.connected) socket.connect();

    const onError = (payload: { message: string }) => setError(payload.message);
    const onRoomCreated = (payload: { roomId: string; room: RoomPayload }) => {
      setActiveRoomId(payload.roomId);
      setRoom(payload.room);
      setNotice(`Room ${payload.roomId} created.`);
      setError('');
    };
    const onRoomJoined = (payload: { roomId: string; room: RoomPayload }) => {
      setActiveRoomId(payload.roomId);
      setRoom(payload.room);
      setNotice(`Joined room ${payload.roomId}.`);
      setError('');
    };
    const onRoomUpdated = (payload: { room: RoomPayload }) => {
      setRoom(payload.room);
    };

    socket.on('error', onError);
    socket.on('room_created', onRoomCreated);
    socket.on('room_joined', onRoomJoined);
    socket.on('room_updated', onRoomUpdated);

    return () => {
      socket.off('error', onError);
      socket.off('room_created', onRoomCreated);
      socket.off('room_joined', onRoomJoined);
      socket.off('room_updated', onRoomUpdated);
    };
  }, [user]);

  async function syncUsername(preferred?: string) {
    if (!user) return '';
    const supabase = getSupabaseClient();
    const profile = await ensureUserProfile(supabase, user, preferred || username);
    if (profile.username !== username) {
      setUsername(profile.username);
    }
    return profile.username;
  }

  async function createRoom() {
    if (!user) return;
    try {
      const syncedUsername = await syncUsername(username);
      const socket = getSocket();
      socket.emit('create_room', {
        userId: user.id,
        username: syncedUsername,
        settings
      });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to sync profile.');
    }
  }

  async function joinRoom() {
    if (!user) return;
    if (!roomCodeInput.trim()) return;
    try {
      const syncedUsername = await syncUsername(username);
      const socket = getSocket();
      socket.emit('join_room', {
        roomId: roomCodeInput.trim().toUpperCase(),
        userId: user.id,
        username: syncedUsername
      });
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Failed to sync profile.');
    }
  }

  async function copyInviteLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setNotice('Invite link copied.');
  }

  if (loading || !user) {
    return (
      <AnimatedLayout>
        <GlassCard>Loading lobby...</GlassCard>
      </AnimatedLayout>
    );
  }

  return (
    <AnimatedLayout>
      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <GlassCard>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
            Lobby
          </h1>
          <p className="mt-1 text-sm text-white/70">Create a room or join one by code.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/70">Your display name</label>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                onBlur={() => {
                  syncUsername(username).catch((syncError) => {
                    console.error('Username sync failed:', syncError);
                  });
                }}
                className="w-full rounded-xl border border-white/15 bg-slateNight/70 px-3 py-2 outline-none ring-aqua/50 focus:ring-2"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/70">Join room code</label>
              <div className="flex gap-2">
                <input
                  value={roomCodeInput}
                  onChange={(event) => setRoomCodeInput(event.target.value)}
                  placeholder="AB12CD34"
                  className="w-full rounded-xl border border-white/15 bg-slateNight/70 px-3 py-2 uppercase outline-none ring-aqua/50 focus:ring-2"
                />
                <button
                  onClick={joinRoom}
                  className="rounded-xl border border-aqua/40 px-4 py-2 text-sm text-aqua transition hover:bg-aqua/10"
                >
                  Join
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <SettingField
              label="Max Players"
              value={settings.maxPlayers}
              onChange={(value) => setSettings((prev) => ({ ...prev, maxPlayers: Number(value) }))}
              min={2}
              max={20}
            />
            <SettingField
              label="Rounds"
              value={settings.rounds}
              onChange={(value) => setSettings((prev) => ({ ...prev, rounds: Number(value) }))}
              min={1}
              max={10}
            />
            <SettingField
              label="Draw Time"
              value={settings.drawTime}
              onChange={(value) => setSettings((prev) => ({ ...prev, drawTime: Number(value) }))}
              min={30}
              max={180}
            />
            <SettingField
              label="Hints"
              value={settings.hints}
              onChange={(value) => setSettings((prev) => ({ ...prev, hints: Number(value) }))}
              min={0}
              max={5}
            />
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/70">Difficulty</label>
              <select
                value={settings.difficulty}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    difficulty: event.target.value as typeof prev.difficulty
                  }))
                }
                className="w-full rounded-xl border border-white/15 bg-slateNight/70 px-3 py-2"
              >
                <option value="mixed">Mixed</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={createRoom}
              className="inline-flex items-center gap-2 rounded-xl bg-aqua px-4 py-2 font-semibold text-slate-900 hover:bg-aqua/90"
            >
              <Plus className="h-4 w-4" />
              Create Room
            </button>

            {activeRoomId && (
              <>
                <button
                  onClick={copyInviteLink}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
                >
                  <Copy className="h-4 w-4" />
                  Copy Invite Link
                </button>
                <Link
                  href={`/game/${activeRoomId}`}
                  className="rounded-xl border border-ember/50 bg-ember/15 px-4 py-2 text-sm text-ember hover:bg-ember/20"
                >
                  Enter Room
                </Link>
              </>
            )}
          </div>

          {error && <p className="mt-4 rounded-xl border border-red-300/30 bg-red-500/10 p-2 text-sm text-red-200">{error}</p>}
          {notice && <p className="mt-4 rounded-xl border border-aqua/30 bg-aqua/10 p-2 text-sm text-aqua">{notice}</p>}
        </GlassCard>

        <GlassCard>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5 text-aqua" />
            Players
          </h2>
          {!room && <p className="mt-4 text-sm text-white/65">No active room yet.</p>}
          {room && (
            <>
              <p className="mt-2 text-xs uppercase tracking-wide text-white/60">Room {room.id}</p>
              <ul className="mt-4 space-y-2">
                {room.players.map((player) => (
                  <li
                    key={player.socketId}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span>{player.username}</span>
                      {player.isHost && <span className="text-xs text-amber-300">Host</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </GlassCard>
      </div>
    </AnimatedLayout>
  );
}

function SettingField({
  label,
  value,
  onChange,
  min,
  max
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-wide text-white/70">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-white/15 bg-slateNight/70 px-3 py-2"
      />
    </div>
  );
}
