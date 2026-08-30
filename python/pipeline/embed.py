"""Embed normalized documents with bge-small and upsert into private.game_embeddings."""

from __future__ import annotations

from pipeline.config import EMBED_MODEL, EMBED_MODEL_VERSION
from pipeline.db import fetch_all, get_client


def main() -> None:
    from sentence_transformers import SentenceTransformer

    supabase = get_client()
    
    games = fetch_all(supabase, "games", "id, embedding_document, description, name")


    rows = []
    for game in games:
        doc = game.get("embedding_document") or game.get("description") or game.get("name")
        if doc:
            rows.append({"id": game["id"], "document": doc})

    if not rows:
        raise SystemExit("No games to embed. Run ingest and clean first.")

    model = SentenceTransformer(EMBED_MODEL)
    texts = [row["document"] for row in rows]
    vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=True, batch_size=32)

    for row, vector in zip(rows, vectors, strict=True):
        literal = "[" + ",".join(f"{float(x):.8f}" for x in vector.tolist()) + "]"
        
        try:
            supabase.rpc("upsert_embedding", {
                "p_game_id": row["id"],
                "p_embedding": literal,
                "p_model": EMBED_MODEL,
                "p_model_version": EMBED_MODEL_VERSION
            }).execute()
        except Exception as e:
            print(f"Failed to upsert embedding for game {row['id']}: {e}")
            
    print(f"Upserted {len(rows)} embeddings ({EMBED_MODEL} {EMBED_MODEL_VERSION})")


if __name__ == "__main__":
    main()
