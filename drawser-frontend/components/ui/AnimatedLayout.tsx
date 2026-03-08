'use client';

import { PropsWithChildren } from 'react';
import { motion } from 'framer-motion';

export function AnimatedLayout({ children }: PropsWithChildren) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0.65, 0.3, 1] }}
      className="animate-fadeIn"
    >
      {children}
    </motion.main>
  );
}
