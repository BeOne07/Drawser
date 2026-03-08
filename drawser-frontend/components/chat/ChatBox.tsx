'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ChatItem } from '@/lib/gameStore';
import { GlassCard } from '@/components/ui/GlassCard';

type ChatBoxProps = {
  messages: ChatItem[];
  onSend: (message: string) => void;
  canGuess: boolean;
  alreadyGuessed: boolean;
  closeGuessMessage?: string;
};

export function ChatBox({
  messages,
  onSend,
  canGuess,
  alreadyGuessed,
  closeGuessMessage
}: ChatBoxProps) {
  const [value, setValue] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  }

  return (
    <GlassCard className="flex h-full min-h-[340px] flex-col p-4">
      <h3 className="mb-3 text-sm uppercase tracking-wide text-white/70">Chat</h3>

      <div ref={containerRef} className="scrollbar-thin flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-lg border px-3 py-2 text-sm ${
              message.type === 'system'
                ? 'border-moss/30 bg-moss/10 text-moss'
                : 'border-white/10 bg-white/5 text-white/90'
            }`}
          >
            <span className="mr-2 font-semibold">{message.username}:</span>
            <span>{message.message}</span>
          </div>
        ))}
      </div>

      {closeGuessMessage && (
        <p className="mt-3 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {closeGuessMessage}
        </p>
      )}

      {alreadyGuessed && (
        <p className="mt-3 rounded-lg border border-moss/30 bg-moss/10 px-3 py-2 text-xs text-moss">
          You already guessed correctly this round.
        </p>
      )}

      <form onSubmit={onSubmit} className="mt-3 flex gap-2">
        <input
          value={value}
          disabled={!canGuess || alreadyGuessed}
          onChange={(event) => setValue(event.target.value)}
          placeholder={canGuess ? 'Type your guess...' : 'Waiting for drawing phase...'}
          className="w-full rounded-xl border border-white/15 bg-slateNight/70 px-3 py-2 text-sm outline-none ring-aqua/50 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canGuess || alreadyGuessed}
          className="rounded-xl bg-aqua px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </GlassCard>
  );
}
