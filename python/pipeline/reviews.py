"""Fetch a small English review sample per game. Idempotent on source_review_id."""

from __future__ import annotations

import time

import httpx
from tqdm import tqdm

from pipeline.config import REVIEWS_PER_GAME
from pipeline.db import fetch_all, get_client
from pipeline.text import strip_html

REVIEWS_URL = "https://store.steampowered.com/appreviews/{appid}"
HEADERS = {"User-Agent": "GameAtlasPipeline/0.1"}


def fetch_reviews(client: httpx.Client, appid: int) -> list[dict]:
    response = client.get(
        REVIEWS_URL.format(appid=appid),
        params={
            "json": 1,
            "language": "english",
            "filter": "updated",
            "purchase_type": "all",
            "num_per_page": REVIEWS_PER_GAME,
        },
    )
    if response.status_code != 200:
        return []
    try:
        payload = response.json()
    except ValueError:
        return []
    reviews = payload.get("reviews") if isinstance(payload, dict) else None
    return reviews if isinstance(reviews, list) else []


def main() -> None:
    supabase = get_client()
    games = fetch_all(supabase, "games", "id, steam_appid")

    stored = 0
    failures = 0
    with httpx.Client(timeout=30.0, headers=HEADERS) as client:
        progress = tqdm(games, desc="reviews")
        for game in progress:
            rows = []
            seen: set[str] = set()
            for review in fetch_reviews(client, game["steam_appid"])[:REVIEWS_PER_GAME]:
                author = review.get("author") if isinstance(review.get("author"), dict) else {}
                rec_id = str(review.get("recommendationid") or "").strip()
                # A repeated key inside one batch would abort the whole upsert.
                if not rec_id or rec_id in seen:
                    continue
                seen.add(rec_id)
                rows.append({
                    "game_id": game["id"],
                    "review_text": strip_html(review.get("review")),
                    "rating": 1 if bool(review.get("voted_up")) else 0,
                    "playtime": int(author.get("playtime_forever") or 0),
                    "review_score": int(review.get("votes_up") or 0),
                    "source": "steam",
                    "source_review_id": rec_id,
                })

            if rows:
                try:
                    supabase.table("game_reviews").upsert(
                        rows, on_conflict="game_id, source_review_id"
                    ).execute()
                    stored += len(rows)
                except Exception as exc:
                    failures += 1
                    if failures <= 5:
                        print(f"Review upsert failed for app {game['steam_appid']}: {exc}")
                progress.set_postfix(stored=stored, failed=failures)
            time.sleep(0.8)

    if failures:
        print(f"WARNING: {failures} games had review writes fail")
    print(f"Stored/updated {stored} reviews")


if __name__ == "__main__":
    main()
