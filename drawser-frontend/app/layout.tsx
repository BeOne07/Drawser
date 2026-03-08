import type { Metadata } from 'next';
import Link from 'next/link';
import { Space_Grotesk, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/AuthProvider';

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display'
});

const body = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-body'
});

export const metadata: Metadata = {
  title: 'Drawser',
  description: 'Multiplayer drawing and guessing game'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} min-h-screen font-sans`}>
        <AuthProvider>
          <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-8 pt-5 sm:px-6 lg:px-8">
            <header className="glass mb-6 flex items-center justify-between rounded-2xl px-5 py-4">
              <Link href="/" className="text-xl font-semibold tracking-wide text-ink">
                Drawser
              </Link>
              <nav className="flex items-center gap-4 text-sm text-white/80">
                <Link href="/lobby" className="hover:text-white">
                  Lobby
                </Link>
                <Link href="/leaderboard" className="hover:text-white">
                  Leaderboard
                </Link>
                <Link href="/profile" className="hover:text-white">
                  Profile
                </Link>
              </nav>
            </header>
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
