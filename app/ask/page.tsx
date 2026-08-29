import { useState } from 'react';

export default function AskPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Placeholder: call a server action that runs rule‑based parser
    setAnswer('This feature is under construction.');
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Ask GameAtlas</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="I love Elden Ring and want something similar but shorter..."
          className="border rounded p-2 w-full h-32"></textarea>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Ask</button>
      </form>
      {answer && (
        <div className="mt-4 p-4 border rounded">
          <h3 className="font-semibold mb-2">Answer</h3>
          <p>{answer}</p>
        </div>
      )}
    </div>
  );
}
