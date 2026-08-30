import Link from 'next/link';

const features = [
  ['Explore the Map', 'Browse a landscape of 1,000+ curated games clustered by the experiences, mechanics, and themes they share.'],
  ['Natural Discovery', 'Describe what you want using your own words. Get transparent, rule-based matches without relying on paid AI.'],
  ['Personalized for You', 'Connect your Steam library securely to weigh your play history and find hidden gems tailored to your taste.'],
];

export default function Home() {
  return (
    <main className="landing">
      <section className="hero fade-in">
        <p className="eyebrow">Semantic Game Discovery</p>
        <h1>Find the game that<br /><em>fits tonight.</em></h1>
        <p className="hero-copy">
          GameAtlas turns a curated Steam catalog into a navigable world of mood, mechanics, and memorable experiences. Find what to play next, visually.
        </p>
        <div className="actions">
          <Link href="/map" className="button button-primary">
            Explore Game Map <span>→</span>
          </Link>
          <Link href="/my-games" className="button button-secondary">
            Connect Steam
          </Link>
        </div>
      </section>
      
      <section className="feature-grid fade-in fade-in-delay-2" aria-label="GameAtlas features">
        {features.map(([title, description], index) => (
          <article className="feature" key={title}>
            <span className="feature-number">0{index + 1}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
