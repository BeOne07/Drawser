'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

type WordSelectorProps = {
  open: boolean;
  words: string[];
  onSelect: (word: string) => void;
  timeoutSeconds?: number;
};

export function WordSelector({ open, words, onSelect, timeoutSeconds = 15 }: WordSelectorProps) {
  const [countdown, setCountdown] = useState(timeoutSeconds);

  useEffect(() => {
    if (!open) return;
    setCountdown(timeoutSeconds);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (words[0]) onSelect(words[0]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onSelect, open, timeoutSeconds, words]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="glass w-full max-w-2xl rounded-2xl p-6"
      >
        <p className="text-xs uppercase tracking-wide text-white/60">Choose a word to draw</p>
        <h3 className="mt-1 text-xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          Pick in {countdown}s
        </h3>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {words.map((word, idx) => (
            <button
              key={`${word}-${idx}`}
              onClick={() => onSelect(word)}
              className="rounded-xl border border-white/15 bg-white/10 px-3 py-4 text-center text-sm font-medium capitalize transition hover:border-aqua/70 hover:bg-aqua/20"
            >
              {word}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
