import Plot from 'react-plotly.js';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

export default function MapPage() {
  const { data, isLoading, error } = useQuery(['gameCoordinates'], async () => {
    const { data, error } = await supabase.from('game_coordinates').select('game_id, x, y');
    if (error) throw new Error(error.message);
    return data;
  });

  if (isLoading) return <div>Loading map...</div>;
  if (error) return <div>Error loading map: {error.message}</div>;

  const points = data?.map((row: any) => ({
    x: row.x,
    y: row.y,
    text: row.game_id,
    type: 'scattergl',
    mode: 'markers',
  }));

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Game Atlas Map</h2>
      {points && (
        <Plot
          data={points}
          layout={{ width: 800, height: 600, title: 'Game Map' }}
        />
      )}
    </div>
  );
}
