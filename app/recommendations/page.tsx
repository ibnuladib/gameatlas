import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

export default function RecommendationsPage() {
  const { data, isLoading, error } = useQuery(['recommendations'], async () => {
    const { data, error } = await supabase.from('recommendations').select('*');
    if (error) throw new Error(error.message);
    return data;
  });

  if (isLoading) return <div>Loading recommendations...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Your Recommendations</h2>
      <ul>
        {data?.map((rec: any) => (
          <li key={rec.id} className="mb-2">
            Game ID: {rec.game_id} – Score: {rec.score.toFixed(2)}
            <br>{rec.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
