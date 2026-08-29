import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

export default function MyGamesPage() {
  const { data, isLoading, error } = useQuery(['myGames'], async () => {
    // TODO: fetch user profile and call Steam API server‑side route
    return [];
  });

  if (isLoading) return <div>Loading your games...</div>;
  if (error) return <div>Error loading games: {error.message}</div>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">My Steam Games</h2>
      {data?.length === 0 ? (
        <p>Connect your Steam account to see your library.</p>
      ) : (
        <ul>
          {data.map((g: any) => (
            <li key={g.game_id} className="mb-2">{g.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
