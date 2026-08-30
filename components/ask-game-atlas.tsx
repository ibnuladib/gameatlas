'use client';

import { FormEvent, useState } from 'react';
import type { RankedGame } from '@/lib/recommendations/engine';

const prompts = [
  'Something atmospheric for a rainy weekend',
  'A short co-op game with friends',
  'I want Elden Ring energy, but easier',
  'A deep strategy game to sink hours into',
];

export function AskGameAtlas() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [games, setGames] = useState<RankedGame[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit(event?: FormEvent) {
    if (event) event.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setAnswer('');
    setGames([]);
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await response.json();
      setAnswer(data.answer);
      setGames(data.games ?? []);
    } catch {
      setAnswer('I could not reach the discovery engine. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const handlePromptClick = (prompt: string) => {
    setQuestion(prompt);
    // Auto submit after setting the prompt, using a short timeout to let state update
    setTimeout(() => submit(), 50);
  };

  return (
    <main className="content-page ask-page">
      <div className="fade-in">
        <p className="eyebrow">Natural language discovery</p>
        <h1>What are you looking for?</h1>
        <p className="page-intro">
          Use your own words. GameAtlas reads your request for mood, genres, playtime, and social preferences — and now uses Groq to refine the results naturally.
        </p>
      </div>

      <form onSubmit={submit} className="ask-form fade-in fade-in-delay-1">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="I want a cozy, story-rich game I can finish in a weekend…"
          disabled={loading}
        />
        <button className="button button-primary" disabled={loading || !question.trim()}>
          {loading ? 'Thinking…' : 'Find Games'} <span>→</span>
        </button>
      </form>

      {!loading && !answer && (
        <div className="prompt-row fade-in fade-in-delay-2">
          {prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => handlePromptClick(prompt)}>
              {prompt}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="typing-indicator fade-in">
          <span /><span /><span />
        </div>
      )}

      {answer && !loading && (
        <section className="answer fade-in">
          <p className="eyebrow">GameAtlas says</p>
          <p>{answer}</p>
        </section>
      )}

      {games.length > 0 && !loading && (
        <div className="game-cards fade-in fade-in-delay-1">
          {games.map((game) => (
            <article key={game.id} className="game-card">
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
                    <span className="game-card-stat" title="Median hours played by sampled reviewers — a rough estimate">
                      ⏱ ~{Math.round(game.average_playtime / 60)}h
                    </span>
                  ) : null}
                </div>
                
                <p style={{ marginTop: '12px' }}>{game.reason}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
