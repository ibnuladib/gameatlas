"""Normalize game text and derive review-backed fields on each games row.

Writes `embedding_document` and `average_playtime`.
"""

from __future__ import annotations

import datetime as dt
import statistics
from collections import defaultdict

from pipeline.config import DOCUMENT_CHAR_CAP
from pipeline.db import fetch_all, get_client
from pipeline.text import join_capped, strip_html


def build_document(row: dict) -> str:
    genres = ", ".join(row.get("genres") or [])
    tags = ", ".join(row.get("steam_tags") or [])
    reviews = row.get("review_excerpts") or []
    parts = [
        strip_html(row.get("name")),
        strip_html(row.get("description")),
        f"Genres: {genres}" if genres else "",
        f"Tags: {tags}" if tags else "",
    ]
    if reviews:
        parts.append("Reviews: " + " ".join(strip_html(r) for r in reviews[:5]))
    return join_capped(parts, DOCUMENT_CHAR_CAP)


def playtime_estimate(playtimes: list[int]) -> int | None:
    """Median playtime, in minutes, across the sampled reviewers.

    SteamSpy stopped publishing playtime and the storefront never exposed it,
    so the reviewer sample is the only free source left. It skews high, since
    reviewers play more than average, and the median keeps a few thousand-hour
    outliers from dominating a sample this small. Surface it as an approximation.
    """
    usable = [p for p in playtimes if p and p > 0]
    if len(usable) < 3:
        return None
    return int(statistics.median(usable))


def main() -> None:
    supabase = get_client()
    
    games = fetch_all(supabase, "games", "id, name, description, genres, steam_tags")
    reviews_data = fetch_all(supabase, "game_reviews", "id, game_id, review_text, playtime")

    reviews_by_game = defaultdict(list)
    playtimes_by_game = defaultdict(list)
    for r in reviews_data:
        if r.get("review_text"):
            reviews_by_game[r["game_id"]].append(r["review_text"])
        if r.get("playtime"):
            playtimes_by_game[r["game_id"]].append(r["playtime"])

    failures = 0
    with_playtime = 0
    for game in games:
        game["review_excerpts"] = reviews_by_game[game["id"]][:5]
        playtime = playtime_estimate(playtimes_by_game[game["id"]])
        if playtime is not None:
            with_playtime += 1

        patch = {
            "embedding_document": build_document(game),
            "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        }
        # Leave a previously derived estimate alone when this run has too small
        # a review sample to improve on it.
        if playtime is not None:
            patch["average_playtime"] = playtime

        try:
            supabase.table("games").update(patch).eq("id", game["id"]).execute()
        except Exception as exc:
            failures += 1
            if failures <= 5:
                print(f"Failed to update game {game['id']}: {exc}")

    if failures:
        print(f"WARNING: {failures} games failed to update")
    print(f"Normalized {len(games)} game documents ({with_playtime} with a playtime estimate)")


if __name__ == "__main__":
    main()
