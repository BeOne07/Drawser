'use client';

import { io, Socket } from 'socket.io-client';

export type Player = {
  socketId: string;
  userId: string;
  username: string;
  avatar: string;
  score: number;
  isHost: boolean;
  hasGuessed?: boolean;
};

export type RoomPayload = {
  id: string;
  hostId: string;
  hostUserId: string;
  players: Player[];
  settings: {
    maxPlayers: number;
    rounds: number;
    drawTime: number;
    difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
    hints: number;
  };
  status: 'waiting' | 'playing' | 'ended';
};

type ChatMessage = {
  id: string;
  socketId: string;
  userId: string;
  username: string;
  avatar: string;
  message: string;
  type: 'chat' | 'system';
  timestamp: number;
};

export type ServerToClientEvents = {
  error: (payload: { message: string }) => void;
  room_created: (payload: { roomId: string; room: RoomPayload }) => void;
  room_joined: (payload: { roomId: string; room: RoomPayload }) => void;
  room_updated: (payload: { room: RoomPayload }) => void;
  room_info: (payload: { room: RoomPayload }) => void;
  player_left: (payload: { socketId: string; username: string }) => void;
  game_started: (payload: { gameState: unknown; players: Player[] }) => void;
  round_started: (payload: {
    round: number;
    totalRounds: number;
    drawer: { socketId: string; username: string };
  }) => void;
  drawer_word_options: (payload: { words: string[] }) => void;
  drawing_phase_started: (payload: {
    round: number;
    totalRounds: number;
    drawer: { socketId: string; username: string } | null;
    hint: string;
    roundTime: number;
    hints: number;
  }) => void;
  current_word: (payload: { word: string }) => void;
  hint_update: (payload: { hint: string; hintsGiven: number }) => void;
  draw_event: (payload: {
    x: number;
    y: number;
    prevX?: number;
    prevY?: number;
    color: string;
    size: number;
    tool: 'brush' | 'eraser' | 'fill';
    type: 'start' | 'move' | 'end' | 'fill';
  }) => void;
  canvas_cleared: () => void;
  stroke_undone: () => void;
  new_message: (payload: ChatMessage) => void;
  close_guess: (payload: { message: string }) => void;
  correct_guess: (payload: {
    socketId: string;
    username: string;
    avatar: string;
    points: number;
    scores: Player[];
  }) => void;
  round_ended: (payload: { word: string; scores: Player[] }) => void;
  game_over: (payload: {
    leaderboard: Array<{ userId: string; username: string; avatar: string; score: number }>;
  }) => void;
};

export type ClientToServerEvents = {
  create_room: (payload: {
    userId: string;
    username: string;
    avatar?: string;
    settings: {
      maxPlayers: number;
      rounds: number;
      drawTime: number;
      difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
      hints: number;
    };
  }) => void;
  join_room: (payload: { roomId: string; userId: string; username: string; avatar?: string }) => void;
  leave_room: () => void;
  get_room_info: (payload: { roomId: string }) => void;
  start_game: (payload: { roomId: string }) => void;
  word_selected: (payload: { roomId: string; word: string }) => void;
  draw_event: (payload: {
    roomId: string;
    x: number;
    y: number;
    prevX?: number;
    prevY?: number;
    color: string;
    size: number;
    tool: 'brush' | 'eraser' | 'fill';
    type: 'start' | 'move' | 'end' | 'fill';
  }) => void;
  clear_canvas: (payload: { roomId: string }) => void;
  undo_stroke: (payload: { roomId: string }) => void;
  send_message: (payload: { roomId: string; message: string }) => void;
};

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket() {
  if (socket) return socket;

  const serverUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3001';
  socket = io(serverUrl, {
    autoConnect: false,
    transports: ['websocket', 'polling']
  });
  return socket;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.disconnect();
}
