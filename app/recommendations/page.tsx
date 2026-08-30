'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { RankedGame } from '@/lib/recommendations/engine';

export default function RecommendationsPage() {
  const [games, setGames] = useState<RankedGame[]>([]);
  const [notice, setNotice] = useState('');
  const [steam, setSteam] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('gameatlas.steam') ?? '';
    setSteam(stored);
    
    if (!stored) {
      setLoading(false);
      setNotice('Connect Steam to build a preference vector from your library.');
      return;
    }
    
    fetch('/api/recommend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ steam: stored }),
    })
      .then((res) => res.json())
      .then((data) => {
        setGames(data.games ?? []);
        setNotice(data.notice ?? (data.relaxed ? 'Some filters were relaxed to find matches.' : ''));
        setLoading(false);
      })
      .catch(() => {
        setNotice('Recommendations could not be loaded.');
        setLoading(false);
      });
  }, []);

  return (
    <main className="content-page">
      <div className="narrow fade-in">
        <p className="eyebrow">For you</p>
        <h1>Personalized curation.</h1>
        <p className="page-intro">
          We use your Steam history to build a semantic preference vector, weighing recent games and playtime. 
          Every recommendation is fully explained using actual tags and metadata — no black boxes.
        </p>
        <div className="actions">
          <Link href="/my-games" className="button button-primary">
            {steam ? 'Change Profile' : 'Connect Steam'} <span>→</span>
          </Link>
          <Link href="/ask" className="button button-secondary">
            Natural Discovery
          </Link>
        </div>
        
        {steam && !loading && (
          <p className="notice" style={{ marginTop: '24px' }}>
            Curating for <strong>{steam}</strong>
          </p>
        )}
        
        {notice && !steam && <p className="notice">{notice}</p>}
        {notice && steam && games.length === 0 && !loading && <p className="notice">{notice}</p>}
      </div>

      {loading ? (
        <div className="game-cards fade-in" style={{ marginTop: '48px' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="game-card loading-shimmer" style={{ height: '280px', border: 'none' }} />
          ))}
        </div>
      ) : games.length > 0 ? (
        <div className="game-cards fade-in fade-in-delay-1" style={{ marginTop: '48px' }}>
          {games.map((game, i) => (
            <article key={game.id} className="game-card" style={{ animationDelay: `${i * 0.05}s` }}>
              {game.header_image_url ? (
                <img src={game.header_image_url} alt={game.name} className="game-card-image" loading="lazy" />
              ) : (
                <div className="game-card-image" style={{ background: 'var(--border)', display: 'grid', placeItems: 'center' }}>
                  <span style={{ opacity: 0.2 }}>No Cover</span>
                </div>
              )}
              <div className="game-card-body">
                <span className="game-card-badge">{Math.round(game.score * 100)}% Match</span>
                <h3>{game.name}</h3>
                
                <div className="game-card-meta">
                  {game.review_score ? (
                    <span className="game-card-stat">
                      ⭐ {game.review_score}%
                    </span>
                  ) : null}
                  {game.average_playtime ? (
                    <span className="game-card-stat">
                      ⏱ {Math.round(game.average_playtime / 60)}h
                    </span>
                  ) : null}
                </div>
                
                <p style={{ marginTop: '12px' }}>{game.reason}</p>
              </div>
            </article>
          ))}
        </div>
      ) : !steam ? (
        <div className="empty-state fade-in fade-in-delay-1">
          <div className="empty-state-icon">🎮</div>
          <h3>Your Library Awaits</h3>
          <p>Connect your Steam account to unlock personalized recommendations based on what you actually play.</p>
        </div>
      ) : null}
    </main>
  );
}
