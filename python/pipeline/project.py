"""UMAP projection of stored embeddings → game_coordinates. Never runs in a request."""

from __future__ import annotations

import numpy as np

from pipeline.config import EMBED_MODEL, EMBED_MODEL_VERSION, PROJECTION_VERSION
from pipeline.db import get_client


def _to_matrix(rows: list[dict]) -> np.ndarray:
    vectors = []
    for row in rows:
        raw = row["embedding"]
        if hasattr(raw, "tolist"):
            vectors.append(np.asarray(raw, dtype=np.float32))
        else:
            text = str(raw).strip().strip("[]")
            vectors.append(np.fromstring(text, sep=",", dtype=np.float32))
    return np.vstack(vectors)


def project(matrix: np.ndarray) -> np.ndarray:
    n = matrix.shape[0]
    if n == 1:
        return np.zeros((1, 2), dtype=np.float32)
    if n < 4:
        from sklearn.decomposition import PCA

        return PCA(n_components=2).fit_transform(matrix)

    import umap

    n_neighbors = max(2, min(15, n - 1))
    reducer = umap.UMAP(
        n_components=2,
        n_neighbors=n_neighbors,
        min_dist=0.15,
        metric="cosine",
        random_state=42,
    )
    return reducer.fit_transform(matrix)


def fetch_all_embeddings(supabase, model: str, model_version: str) -> list[dict]:
    """Page through get_embeddings — PostgREST silently caps RPC results at 1000."""
    rows: list[dict] = []
    start = 0
    page_size = 1000
    while True:
        res = (
            supabase.rpc(
                "get_embeddings",
                {"p_model": model, "p_model_version": model_version},
            )
            .range(start, start + page_size - 1)
            .execute()
        )
        page = res.data or []
        rows.extend(page)
        if len(page) < page_size:
            return rows
        start += page_size


def main() -> None:
    supabase = get_client()

    rows = fetch_all_embeddings(supabase, EMBED_MODEL, EMBED_MODEL_VERSION)
    
    if not rows:
        raise SystemExit("No embeddings to project. Run embed first.")
        
    coords = project(_to_matrix(rows))
    
    batch = []
    for row, (x, y) in zip(rows, coords, strict=True):
        batch.append({
            "game_id": row["game_id"],
            "x": float(x),
            "y": float(y),
            "projection_version": PROJECTION_VERSION
        })
        
        if len(batch) >= 100:
            supabase.table("game_coordinates").upsert(
                batch, on_conflict="game_id, projection_version"
            ).execute()
            batch = []
            
    if batch:
        supabase.table("game_coordinates").upsert(
            batch, on_conflict="game_id, projection_version"
        ).execute()

    print(f"Wrote {len(rows)} coordinates ({PROJECTION_VERSION})")


if __name__ == "__main__":
    main()
