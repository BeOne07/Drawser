'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Play, Users } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { AnimatedLayout } from '@/components/ui/AnimatedLayout';
import { GlassCard } from '@/components/ui/GlassCard';
import { RoundInfo } from '@/components/game/RoundInfo';
import { WordSelector } from '@/components/game/WordSelector';
import { PlayerList } from '@/components/playerList/PlayerList';
import { ChatBox } from '@/components/chat/ChatBox';
import { DrawingCanvas, DrawingCanvasRef } from '@/components/canvas/DrawingCanvas';
import { Toolbar } from '@/components/canvas/Toolbar';
import { getSocket, Player, RoomPayload } from '@/lib/socket';
import { useGameStore } from '@/lib/gameStore';
import { ensureUserProfile } from '@/lib/profileSync';
import { getSupabaseClient } from '@/lib/supabase';

type Tool = 'brush' | 'eraser' | 'fill';

export default function GameRoomPage() {
  const router = useRouter();
  const params = useParams<{ roomId?: string | string[] }>();
  const { user, loading } = useAuth();
  const canvasRef = useRef<DrawingCanvasRef | null>(null);
  const roundEndsAtRef = useRef(0);
  const skipNextDevCleanupRef = useRef(process.env.NODE_ENV === 'development');

  const routeRoomId = useMemo(() => {
    const raw = params?.roomId;
    const roomId = Array.isArray(raw) ? raw[0] : raw;
    return typeof roomId === 'string' ? roomId.toUpperCase() : '';
  }, [params]);

  const {
    phase,
    players,
    messages,
    round,
    totalRounds,
    timeLeft,
    hint,
    currentDrawerId,
    currentWord,
    wordOptions,
    leaderboard,
    setRoomId,
    setPlayers,
    setPhase,
    setRound,
    setTimeLeft,
    setHint,
    setDrawer,
    setCurrentWord,
    setWordOptions,
    setLeaderboard,
    addMessage,
    reset
  } = useGameStore();

  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState('#111827');
  const [size, setSize] = useState(4);
  const [error, setError] = useState('');
  const [closeGuessMessage, setCloseGuessMessage] = useState('');
  const [room, setRoom] = useState<RoomPayload | null>(null);

  useEffect(() => {
    if (!routeRoomId) return;
    setRoomId(routeRoomId);
  }, [routeRoomId, setRoomId]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth');
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user || !routeRoomId) return;

    const socket = getSocket();
    if (!socket.connected) socket.connect();
    const supabase = getSupabaseClient();
    let cancelled = false;

    const onError = (payload: { message: string }) => setError(payload.message);
    const onRoomJoined = (payload: { roomId: string; room: RoomPayload }) => {
      setRoom(payload.room);
      setPlayers(payload.room.players);
    };
    const onRoomInfo = (payload: { room: RoomPayload }) => {
      setRoom(payload.room);
      setPlayers(payload.room.players);
    };
    const onRoomUpdated = (payload: { room: RoomPayload }) => {
      setRoom(payload.room);
      setPlayers(payload.room.players);
    };

    const onGameStarted = (payload: { players: Player[] }) => {
      setPhase('word_selection');
      setPlayers(payload.players);
      setCurrentWord('');
      setHint('');
      setCloseGuessMessage('');
    };

    const onRoundStarted = (payload: {
      round: number;
      totalRounds: number;
      drawer: { socketId: string; username: string };
    }) => {
      setPhase('word_selection');
      setRound(payload.round, payload.totalRounds);
      setDrawer(payload.drawer.socketId);
      setHint('');
      setCurrentWord('');
      setWordOptions([]);
      setCloseGuessMessage('');
      addMessage({
        id: `system-round-${Date.now()}`,
        username: 'System',
        avatar: '',
        message: `${payload.drawer.username} is choosing a word`,
        type: 'system',
        timestamp: Date.now()
      });
    };

    const onWordOptions = (payload: { words: string[] }) => {
      setWordOptions(payload.words);
    };

    const onDrawingPhaseStarted = (payload: {
      round: number;
      totalRounds: number;
      drawer: { socketId: string; username: string } | null;
      hint: string;
      roundTime: number;
    }) => {
      setPhase('drawing');
      setRound(payload.round, payload.totalRounds);
      setDrawer(payload.drawer?.socketId || null);
      setHint(payload.hint);
      setWordOptions([]);
      setTimeLeft(payload.roundTime);
      roundEndsAtRef.current = Date.now() + payload.roundTime * 1000;
    };

    const onCurrentWord = (payload: { word: string }) => setCurrentWord(payload.word);
    const onHintUpdate = (payload: { hint: string }) => setHint(payload.hint);

    const onNewMessage = (payload: {
      id: string;
      username: string;
      avatar: string;
      message: string;
      type: 'chat' | 'system';
      timestamp: number;
    }) => addMessage(payload);

    const onCloseGuess = (payload: { message: string }) => setCloseGuessMessage(payload.message);

    const onCorrectGuess = (payload: {
      socketId: string;
      username: string;
      points: number;
      scores: Player[];
    }) => {
      setPlayers(payload.scores);
      addMessage({
        id: `system-correct-${Date.now()}`,
        username: 'System',
        avatar: '',
        message: `${payload.username} guessed correctly (+${payload.points})`,
        type: 'system',
        timestamp: Date.now()
      });
      setCloseGuessMessage('');
    };

    const onRoundEnded = (payload: { word: string; scores: Player[] }) => {
      setPhase('scoring');
      setPlayers(payload.scores);
      setCurrentWord(payload.word);
      setHint(payload.word);
      setTimeLeft(0);
      addMessage({
        id: `system-round-end-${Date.now()}`,
        username: 'System',
        avatar: '',
        message: `Round ended. Word was "${payload.word}".`,
        type: 'system',
        timestamp: Date.now()
      });
    };

    const onGameOver = (payload: {
      leaderboard: Array<{ userId: string; username: string; avatar: string; score: number }>;
    }) => {
      setPhase('game_over');
      setLeaderboard(payload.leaderboard);
      setWordOptions([]);
      setTimeLeft(0);
    };

    socket.on('error', onError);
    socket.on('room_joined', onRoomJoined);
    socket.on('room_info', onRoomInfo);
    socket.on('room_updated', onRoomUpdated);
    socket.on('game_started', onGameStarted);
    socket.on('round_started', onRoundStarted);
    socket.on('drawer_word_options', onWordOptions);
    socket.on('drawing_phase_started', onDrawingPhaseStarted);
    socket.on('current_word', onCurrentWord);
    socket.on('hint_update', onHintUpdate);
    socket.on('new_message', onNewMessage);
    socket.on('close_guess', onCloseGuess);
    socket.on('correct_guess', onCorrectGuess);
    socket.on('round_ended', onRoundEnded);
    socket.on('game_over', onGameOver);

    const joinRoom = async () => {
      try {
        const profile = await ensureUserProfile(supabase, user);
        if (cancelled) return;

        socket.emit('join_room', {
          roomId: routeRoomId,
          userId: user.id,
          username: profile.username
        });
        socket.emit('get_room_info', { roomId: routeRoomId });
      } catch (syncError) {
        if (cancelled) return;
        setError(syncError instanceof Error ? syncError.message : 'Failed to sync profile.');
      }
    };

    joinRoom();

    return () => {
      cancelled = true;
      // React Strict Mode in dev mounts, unmounts, and remounts effects once.
      // Skip the first cleanup so we do not drop/delete the room immediately.
      if (skipNextDevCleanupRef.current) {
        skipNextDevCleanupRef.current = false;
      } else {
        socket.emit('leave_room');
      }
      socket.off('error', onError);
      socket.off('room_joined', onRoomJoined);
      socket.off('room_info', onRoomInfo);
      socket.off('room_updated', onRoomUpdated);
      socket.off('game_started', onGameStarted);
      socket.off('round_started', onRoundStarted);
      socket.off('drawer_word_options', onWordOptions);
      socket.off('drawing_phase_started', onDrawingPhaseStarted);
      socket.off('current_word', onCurrentWord);
      socket.off('hint_update', onHintUpdate);
      socket.off('new_message', onNewMessage);
      socket.off('close_guess', onCloseGuess);
      socket.off('correct_guess', onCorrectGuess);
      socket.off('round_ended', onRoundEnded);
      socket.off('game_over', onGameOver);
      reset();
    };
  }, [
    addMessage,
    reset,
    routeRoomId,
    setCurrentWord,
    setDrawer,
    setHint,
    setLeaderboard,
    setPhase,
    setPlayers,
    setRound,
    setRoomId,
    setTimeLeft,
    setWordOptions,
    user
  ]);

  useEffect(() => {
    if (phase !== 'drawing') return;

    const timer = setInterval(() => {
      const left = Math.max(0, (roundEndsAtRef.current - Date.now()) / 1000);
      setTimeLeft(left);
    }, 250);

    return () => clearInterval(timer);
  }, [phase, setTimeLeft]);

  const socket = getSocket();
  const isDrawer = socket.id ? socket.id === currentDrawerId : false;
  const me = players.find((player) => player.socketId === socket.id);
  const canStart = Boolean(me?.isHost) && players.length >= 2 && room?.status !== 'playing';
  const canGuess = phase === 'drawing' && !isDrawer;

  function onSendMessage(message: string) {
    if (!routeRoomId) return;
    socket.emit('send_message', { roomId: routeRoomId, message });
  }

  function onStartGame() {
    if (!routeRoomId) return;
    socket.emit('start_game', { roomId: routeRoomId });
  }

  function onSelectWord(word: string) {
    if (!routeRoomId) return;
    socket.emit('word_selected', { roomId: routeRoomId, word });
    setWordOptions([]);
  }

  function onUndo() {
    if (!isDrawer || !routeRoomId) return;
    canvasRef.current?.undoStroke();
    socket.emit('undo_stroke', { roomId: routeRoomId });
  }

  function onClear() {
    if (!isDrawer || !routeRoomId) return;
    canvasRef.current?.clearCanvas();
    socket.emit('clear_canvas', { roomId: routeRoomId });
  }

  if (!routeRoomId) {
    return (
      <AnimatedLayout>
        <GlassCard>Loading room...</GlassCard>
      </AnimatedLayout>
    );
  }

  if (loading || !user) {
    return (
      <AnimatedLayout>
        <GlassCard>Loading room...</GlassCard>
      </AnimatedLayout>
    );
  }

  return (
    <AnimatedLayout>
      <div className="space-y-4">
        <RoundInfo round={round} totalRounds={totalRounds} timeLeft={timeLeft} hint={hint} />

        <div className="grid gap-4 lg:grid-cols-[260px_1fr_340px]">
          <PlayerList players={players} currentDrawerId={currentDrawerId} />

          <div className="space-y-3">
            <DrawingCanvas
              ref={canvasRef}
              roomId={routeRoomId}
              isDrawer={isDrawer && phase === 'drawing'}
              color={color}
              size={size}
              tool={tool}
            />
            <Toolbar
              disabled={!isDrawer || phase !== 'drawing'}
              color={color}
              size={size}
              tool={tool}
              onToolChange={setTool}
              onColorChange={setColor}
              onSizeChange={setSize}
              onUndo={onUndo}
              onClear={onClear}
            />
            {isDrawer && currentWord && (
              <p className="rounded-xl border border-aqua/30 bg-aqua/10 px-3 py-2 text-sm text-aqua">
                Your word: <span className="font-semibold capitalize">{currentWord}</span>
              </p>
            )}
            {canStart && (
              <button
                onClick={onStartGame}
                className="inline-flex items-center gap-2 rounded-xl bg-ember px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-ember/90"
              >
                <Play className="h-4 w-4" />
                Start Game
              </button>
            )}
          </div>

          <ChatBox
            messages={messages}
            onSend={onSendMessage}
            canGuess={canGuess}
            alreadyGuessed={Boolean(me?.hasGuessed)}
            closeGuessMessage={closeGuessMessage}
          />
        </div>

        <WordSelector open={isDrawer && wordOptions.length > 0} words={wordOptions} onSelect={onSelectWord} />

        {error && (
          <p className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>
        )}

        {phase === 'game_over' && (
          <GlassCard className="p-5">
            <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
              Game Over
            </h3>
            <ul className="mt-3 space-y-2">
              {leaderboard.map((entry, index) => (
                <li
                  key={`${entry.userId}-${index}`}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <span>
                    #{index + 1} {entry.username}
                  </span>
                  <span className="font-semibold">{entry.score}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-3">
              <Link href="/lobby" className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/10">
                Back to Lobby
              </Link>
              <Link href="/leaderboard" className="rounded-xl border border-aqua/40 px-4 py-2 text-sm text-aqua hover:bg-aqua/10">
                View Leaderboard
              </Link>
            </div>
          </GlassCard>
        )}

        <GlassCard className="p-3 text-xs text-white/60">
          <p className="inline-flex items-center gap-2">
            <Users className="h-4 w-4 text-aqua" />
            Room ID: <span className="font-mono text-white">{routeRoomId}</span>
          </p>
        </GlassCard>
      </div>
    </AnimatedLayout>
  );
}
