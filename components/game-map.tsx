'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { MappedGame, SimilarGame } from '@/lib/games/types';

// Plotly needs to be dynamically imported with SSR disabled because it relies on the window object
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

type Detail = MappedGame & { similar?: SimilarGame[] };

export function GameMap() {
  const [games, setGames] = useState<MappedGame[]>([]);
  const [status, setStatus] = useState('Loading atlas…');
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('');
  const [selected, setSelected] = useState<Detail | null>(null);
  const [neighbors, setNeighbors] = useState<number[]>([]);
  const [allGenres, setAllGenres] = useState<string[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (genre) params.set('genre', genre);
    fetch(`/api/games?${params}`)
      .then((r) => r.json())
      .then(({ games: rows, configured, error }: { games: MappedGame[]; configured: boolean; error?: string }) => {
        setGames(rows);
        if (!genre) {
          const set = new Set<string>();
          for (const game of rows) for (const name of game.genres ?? []) set.add(name);
          setAllGenres([...set].sort());
        }
        if (error) setStatus(error);
        else if (!configured) setStatus('Connect Supabase and run the pipeline to populate your atlas.');
        else if (!rows.length) setStatus('No projected games yet — run the data pipeline to populate the atlas.');
        else setStatus('');
      })
      .catch(() => setStatus('The atlas could not be reached.'));
  }, [genre]);

  const visible = useMemo(
    () => games.filter((game) => game.name.toLowerCase().includes(query.toLowerCase())),
    [games, query],
  );

  async function selectGame(game: MappedGame) {
    setSelected(game);
    const res = await fetch(`/api/games/${game.id}`);
    if (!res.ok) return;
    const data: { similar?: SimilarGame[] } = await res.json();
    setNeighbors((data.similar ?? []).map((row) => row.id));
    setSelected({ ...game, similar: data.similar });
  }

  // Memoize Plotly data to prevent unnecessary re-renders of the WebGL canvas
  const plotData = useMemo(() => {
    if (!visible.length) return [];
    
    // Split into three traces: unselected, neighbors, and selected
    // for proper z-ordering and styling in Plotly
    const selectedId = selected?.id;
    
    const unselectedX: number[] = [];
    const unselectedY: number[] = [];
    const unselectedHover: string[] = [];
    const unselectedIds: number[] = [];
    
    const neighborX: number[] = [];
    const neighborY: number[] = [];
    const neighborHover: string[] = [];
    const neighborIds: number[] = [];
    
    const selectedX: number[] = [];
    const selectedY: number[] = [];
    const selectedHover: string[] = [];
    const selectedIds: number[] = [];

    visible.forEach(game => {
      if (game.id === selectedId) {
        selectedX.push(game.x);
        selectedY.push(game.y);
        selectedHover.push(game.name);
        selectedIds.push(game.id);
      } else if (neighbors.includes(game.id)) {
        neighborX.push(game.x);
        neighborY.push(game.y);
        neighborHover.push(game.name);
        neighborIds.push(game.id);
      } else {
        unselectedX.push(game.x);
        unselectedY.push(game.y);
        unselectedHover.push(game.name);
        unselectedIds.push(game.id);
      }
    });

    return [
      {
        x: unselectedX,
        y: unselectedY,
        text: unselectedHover,
        customdata: unselectedIds,
        type: 'scattergl' as const,
        mode: 'markers' as const,
        marker: { 
          size: 6, 
          color: '#95c44d',
          opacity: 0.6,
          line: { width: 0 }
        },
        hoverinfo: 'text' as const,
        name: 'Games',
        showlegend: false
      },
      {
        x: neighborX,
        y: neighborY,
        text: neighborHover,
        customdata: neighborIds,
        type: 'scattergl' as const,
        mode: 'markers' as const,
        marker: { 
          size: 8, 
          color: '#7ec8e3',
          opacity: 0.9,
          line: { width: 1, color: '#fff' }
        },
        hoverinfo: 'text' as const,
        name: 'Similar',
        showlegend: false
      },
      {
        x: selectedX,
        y: selectedY,
        text: selectedHover,
        customdata: selectedIds,
        type: 'scattergl' as const,
        mode: 'markers' as const,
        marker: { 
          size: 11, 
          color: '#ffffff',
          line: { width: 2, color: '#bdf16b' }
        },
        hoverinfo: 'text' as const,
        name: 'Selected',
        showlegend: false
      }
    ];
  }, [visible, selected, neighbors]);

  return (
    <main className="map-page">
      <div className="map-heading fade-in">
        <div>
          <p className="eyebrow">The atlas</p>
          <h1>Explore by feel.</h1>
        </div>
        <div className="map-controls">
          <label className="search">
            <span>⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the map" />
          </label>
          <label className="search">
            <span>Genre</span>
            <select value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">All</option>
              {allGenres.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <section className="map-layout fade-in fade-in-delay-1">
        <div className="map-canvas" aria-label="Interactive game map">
          {isClient && plotData.length > 0 && (
            <div className="plotly-container">
              <Plot
                data={plotData}
                layout={{
                  autosize: true,
                  margin: { l: 0, r: 0, t: 0, b: 0, pad: 0 },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  hovermode: 'closest',
                  xaxis: {
                    showgrid: false,
                    zeroline: false,
                    showticklabels: false,
                    fixedrange: false,
                  },
                  yaxis: {
                    showgrid: false,
                    zeroline: false,
                    showticklabels: false,
                    fixedrange: false,
                  },
                  dragmode: 'pan',
                }}
                config={{
                  displayModeBar: false,
                  scrollZoom: true,
                  responsive: true,
                }}
                onHover={(data) => {
                  if (data.points.length > 0) {
                    const point = data.points[0];
                    document.body.style.cursor = 'pointer';
                  }
                }}
                onUnhover={() => {
                  document.body.style.cursor = 'default';
                }}
                onClick={(data) => {
                  if (data.points.length > 0) {
                    const point = data.points[0];
                    const gameId = point.customdata;
                    const game = visible.find(g => g.id === gameId);
                    if (game) selectGame(game);
                  }
                }}
                style={{ width: '100%', height: '100%' }}
                useResizeHandler={true}
              />
            </div>
          )}
          {status && <p className="map-status">{status}</p>}
          <span className="axis axis-x">MORE EXPANSIVE →</span>
          <span className="axis axis-y">← MORE INTIMATE</span>
        </div>
        <aside className="game-panel">
          {selected ? (
            <div className="fade-in">
              <p className="eyebrow">Selected game</p>
              {selected.header_image_url ? (
                <img className="panel-cover" src={selected.header_image_url} alt={selected.name} />
              ) : (
                <div className="panel-cover" style={{ height: '112px', background: 'var(--border)', display: 'grid', placeItems: 'center' }}>
                  <span style={{ opacity: 0.2, color: 'var(--text-primary)' }}>No Cover</span>
                </div>
              )}
              <h2>{selected.name}</h2>
              <p className="genre-list">{selected.genres?.join(' · ') || 'Genre data pending'}</p>
              <p style={{ marginTop: '10px' }}>{selected.description}</p>
              <dl>
                <div>
                  <dt>Steam score</dt>
                  <dd>{selected.review_score ? `${selected.review_score}%` : '—'}</dd>
                </div>
                <div>
                  <dt title="Median hours played by the reviewers we sampled. Reviewers play more than average, so treat this as a rough upper estimate.">
                    Playtime (est.)
                  </dt>
                  <dd>{selected.average_playtime ? `~${Math.round(selected.average_playtime / 60)} hrs` : '—'}</dd>
                </div>
                <div>
                  <dt>Developer</dt>
                  <dd>{selected.developer ?? '—'}</dd>
                </div>
              </dl>
              {selected.similar && selected.similar.length > 0 && (
                <div className="similar-list">
                  <p className="eyebrow">Similar games</p>
                  <ul>
                    {selected.similar.map((game) => (
                      <li key={game.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{game.name}</span>
                        <span style={{ opacity: 0.5 }}>{(100 - (game.distance * 100)).toFixed(0)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="panel-note">Position and neighbors come from precomputed embeddings in Postgres — not a live LLM.</p>
            </div>
          ) : (
            <div className="fade-in">
              <p className="eyebrow">Start exploring</p>
              <h2>Choose a point.</h2>
              <p>Each point is a game. Nearby games share themes, mechanics, and player experience.</p>
              <p style={{ marginTop: '12px' }}>Scroll to zoom, drag to pan the map.</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
