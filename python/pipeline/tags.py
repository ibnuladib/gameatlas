"""Assign taxonomy tags from Steam genres/categories. Idempotent on (game_id, tag_id)."""

from __future__ import annotations

from pipeline.db import fetch_all, get_client
from pipeline.taxonomy import TAXONOMY, blob_from_row, matched_tags


def main() -> None:
    supabase = get_client()
    
    for name, (category, _) in TAXONOMY.items():
        supabase.table("game_tags").upsert(
            {"name": name, "category": category}, 
            on_conflict="name"
        ).execute()
        
    tags_res = supabase.table("game_tags").select("id, name").execute()
    tags = {row["name"]: row["id"] for row in (tags_res.data or [])}
    
    games = fetch_all(supabase, "games", "id, genres, steam_tags")


    count = 0
    assignments_batch = []
    
    for game in games:
        for name, _category, confidence, source in matched_tags(blob_from_row(game)):
            tag_id = tags.get(name)
            if not tag_id:
                continue
            assignments_batch.append({
                "game_id": game["id"],
                "tag_id": tag_id,
                "confidence": confidence,
                "source": source
            })
            count += 1
            
            # Batch inserts to avoid request limits
            if len(assignments_batch) >= 100:
                supabase.table("game_tag_assignments").upsert(
                    assignments_batch, 
                    on_conflict="game_id, tag_id"
                ).execute()
                assignments_batch = []
                
    if assignments_batch:
        supabase.table("game_tag_assignments").upsert(
            assignments_batch, 
            on_conflict="game_id, tag_id"
        ).execute()
        
    print(f"Wrote {count} tag assignments")


if __name__ == "__main__":
    main()
