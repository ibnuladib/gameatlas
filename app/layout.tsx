import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = { 
  title: 'GameAtlas — Find your next world', 
  description: 'A map for discovering Steam games by theme, mechanic, and feel.' 
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header fade-in">
          <Link href="/" className="brand">GAME<span>ATLAS</span></Link>
          <nav>
            <Link href="/map">Map</Link>
            <Link href="/ask">Ask</Link>
            <Link href="/recommendations">For you</Link>
            <Link href="/my-games" className="nav-cta">Connect Steam</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
