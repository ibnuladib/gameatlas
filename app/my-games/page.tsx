'use client';

import { FormEvent, useState, useEffect } from 'react';

type LibraryGame = {
  id: number;
  name: string;
  header_image_url: string | null;
  genres: string[] | null;
  playtimeMinutes: number;
  recent: boolean;
};

export default function MyGamesPage() {
  const [steamId, setSteamId] = useState('');
  const [message, setMessage] = useState('');
  const [games, setGames] = useState<LibraryGame[]>([]);
  const [unavailable, setUnavailable] = useState<{ appid: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('gameatlas.steam');
    if (saved) setSteamId(saved);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setGames([]);
    setUnavailable([]);
    try {
      const response = await fetch('/api/steam/library', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ steam: steamId }),
      });
      const data = await response.json();
      if (data.steamId) localStorage.setItem('gameatlas.steam', steamId);
      setGames(data.games ?? []);
      setUnavailable(data.unavailable ?? []);
      setMessage(data.notice || data.error || (data.games?.length ? '' : 'No matching catalog games yet.'));
    } catch {
      setMessage('Could not reach the Steam lookup.');
    } finally {
      setLoading(false);
    }
  }

  const recentGames = games.filter(g => g.recent);
  const olderGames = games.filter(g => !g.recent);

  return (
    <main className="content-page">
      <div className="fade-in narrow">
        <p className="eyebrow">Your library</p>
        <h1>Make recommendations yours.</h1>
        <p className="page-intro">
          Enter a public Steam ID to use your play history as a signal. GameAtlas securely matches your library to our curated catalog to build a weighted preference vector.
        </p>
        
        <form onSubmit={submit} className="steam-form fade-in fade-in-delay-1">
          <label htmlFor="steam-id">Steam ID or Custom URL</label>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <input
              id="steam-id"
              value={steamId}
              onChange={(event) => setSteamId(event.target.value)}
              placeholder="7656119… or steamcommunity.com/id/name"
              required
              style={{ flex: 1, minWidth: '240px' }}
              disabled={loading}
            />
            <button className="button button-primary" disabled={loading || !steamId.trim()}>
              {loading ? 'Looking up…' : 'Connect Steam'} <span>→</span>
            </button>
          </div>
        </form>
        
        {message && <p className="notice fade-in">{message}</p>}
      </div>

      {games.length > 0 && (
        <div className="fade-in fade-in-delay-2" style={{ marginTop: '48px' }}>
          {recentGames.length > 0 && (
            <>
              <h2 className="category-label">Recently Played</h2>
              <div className="game-cards">
                {recentGames.map((game) => (
                  <article key={game.id} className="game-card">
                    {game.header_image_url ? (
                      <img src={game.header_image_url} alt={game.name} className="game-card-image" loading="lazy" />
                    ) : (
                      <div className="game-card-image" style={{ background: 'var(--border)', display: 'grid', placeItems: 'center' }}>
                        <span style={{ opacity: 0.2 }}>No Cover</span>
                      </div>
                    )}
                    <div className="game-card-body">
                      <h3>{game.name}</h3>
                      <div className="game-card-meta">
                        <span className="game-card-stat">
                          ⏱ {Math.round(game.playtimeMinutes / 60)}h on record
                        </span>
                      </div>
                      <div className="score-bar">
                        <div className="score-bar-fill" style={{ width: `${Math.min(100, (game.playtimeMinutes / 1200) * 100)}%` }} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {olderGames.length > 0 && (
            <>
              <h2 className="category-label" style={{ marginTop: recentGames.length ? '48px' : '0' }}>Top Played</h2>
              <div className="game-cards">
                {olderGames.slice(0, 24).map((game) => (
                  <article key={game.id} className="game-card">
                    {game.header_image_url ? (
                      <img src={game.header_image_url} alt={game.name} className="game-card-image" loading="lazy" />
                    ) : (
                      <div className="game-card-image" style={{ background: 'var(--border)', display: 'grid', placeItems: 'center' }}>
                        <span style={{ opacity: 0.2 }}>No Cover</span>
                      </div>
                    )}
                    <div className="game-card-body">
                      <h3>{game.name}</h3>
                      <div className="game-card-meta">
                        <span className="game-card-stat">
                          ⏱ {Math.round(game.playtimeMinutes / 60)}h on record
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {unavailable.length > 0 && (
        <p className="notice fade-in narrow" style={{ marginTop: '48px' }}>
          {unavailable.length} owned titles are outside the current catalog and were skipped. The catalog is intentionally curated to popular titles for better semantic mapping.
        </p>
      )}
    </main>
  );
}
