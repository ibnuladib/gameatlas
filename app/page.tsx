import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
      <h1 className="text-4xl font-bold mb-4">GameAtlas</h1>
      <p className="mb-6 text-lg">Explore a semantic map of 1,000 Steam games, discover recommendations, and connect your Steam profile.</p>
      <div className="flex space-x-4">
        <Link href="/map" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
          Explore Game Map
        </Link>
        <Link href="/my-games" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">
          Connect Steam
        </Link>
      </div>
    </main>
  );
}
