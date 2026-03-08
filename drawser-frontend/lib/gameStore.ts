'use client';

import { create } from 'zustand';
import { Player } from '@/lib/socket';

export type ChatItem = {
  id: string;
  username: string;
  avatar: string;
  message: string;
  type: 'chat' | 'system';
  timestamp: number;
};

type GamePhase =
  | 'waiting'
  | 'word_selection'
  | 'drawing'
  | 'scoring'
  | 'next_round'
  | 'game_over';

type GameStore = {
  roomId: string;
  phase: GamePhase;
  players: Player[];
  messages: ChatItem[];
  round: number;
  totalRounds: number;
  timeLeft: number;
  hint: string;
  currentDrawerId: string | null;
  currentWord: string;
  wordOptions: string[];
  leaderboard: Array<{ userId: string; username: string; avatar: string; score: number }>;
  setRoomId: (roomId: string) => void;
  setPlayers: (players: Player[]) => void;
  setPhase: (phase: GamePhase) => void;
  setRound: (round: number, totalRounds: number) => void;
  setTimeLeft: (timeLeft: number) => void;
  setHint: (hint: string) => void;
  setDrawer: (socketId: string | null) => void;
  setCurrentWord: (word: string) => void;
  setWordOptions: (words: string[]) => void;
  setLeaderboard: (
    leaderboard: Array<{ userId: string; username: string; avatar: string; score: number }>
  ) => void;
  addMessage: (message: ChatItem) => void;
  reset: () => void;
};

const initialState = {
  roomId: '',
  phase: 'waiting' as GamePhase,
  players: [] as Player[],
  messages: [] as ChatItem[],
  round: 1,
  totalRounds: 1,
  timeLeft: 0,
  hint: '',
  currentDrawerId: null as string | null,
  currentWord: '',
  wordOptions: [] as string[],
  leaderboard: [] as Array<{ userId: string; username: string; avatar: string; score: number }>
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,
  setRoomId: (roomId) => set({ roomId }),
  setPlayers: (players) => set({ players }),
  setPhase: (phase) => set({ phase }),
  setRound: (round, totalRounds) => set({ round, totalRounds }),
  setTimeLeft: (timeLeft) => set({ timeLeft }),
  setHint: (hint) => set({ hint }),
  setDrawer: (socketId) => set({ currentDrawerId: socketId }),
  setCurrentWord: (word) => set({ currentWord: word }),
  setWordOptions: (words) => set({ wordOptions: words }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  reset: () => set(initialState)
}));
