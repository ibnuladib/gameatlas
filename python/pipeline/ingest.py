"""Pull ~2,000 popular Steam games and upsert into `games`.

Popularity ranking uses SteamSpy owner/review proxies (the storefront cannot
rank the full app list without hundreds of thousands of rate-limited calls).
Metadata always comes from Steam's storefront `appdetails` endpoint.
"""

from __future__ import annotations

import argparse
import datetime as dt
import time
from typing import Any

import httpx
from tqdm import tqdm

from pipeline.config import APPDETAILS_DELAY_S, TARGET_GAMES
from pipeline.db import get_client
from pipeline.text import strip_html

STOREFRONT = "https://store.steampowered.com/api/appdetails"
STEAMSPY_PAGE = "https://steamspy.com/api.php"
HEADERS = {"User-Agent": "GameAtlasPipeline/0.1 (educational; contact via repo)"}

# Used when SteamSpy is unreachable so a first run can still populate a catalog.
FALLBACK_APPIDS = [
    730, 570, 440, 1172470, 578080, 271590, 252490, 1091500, 1245620, 1086940,
    814380, 413150, 367520, 105600, 322330, 892970, 394690, 381210, 582010,
    292030, 377160, 489830, 1097150, 1145360, 1174180, 814380, 1240440, 1817070,
    1966720, 2358720, 1623730, 1938090, 990080, 814580, 646570, 268500, 275850,
    431960, 4000, 220, 240, 300, 550, 620, 400, 220200, 239140, 304430, 391220,
    812140, 1326470, 1238840, 1593500, 1551360, 1888930, 1085660, 230410, 444090,
    582160, 311210, 359550, 1172380, 1325200, 1940340, 2050650, 553850, 1364780,
]


def _parse_release_date(raw: Any) -> dt.date | None:
    if not isinstance(raw, dict) or raw.get("coming_soon"):
        return None
    date_str = str(raw.get("date") or "").strip()
    for fmt in ("%d %b, %Y", "%b %d, %Y", "%d %b %Y", "%b %Y", "%Y"):
        try:
            parsed = dt.datetime.strptime(date_str, fmt)
            return parsed.date()
        except ValueError:
            continue
    return None


def _platforms(raw: Any) -> list[str]:
    if not isinstance(raw, dict):
        return []
    return [name for name, enabled in raw.items() if enabled]


def _int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def fetch_popular_appids(limit: int) -> tuple[list[int], dict[int, dict[str, int]]]:
    """Rank candidate appids by review volume and keep SteamSpy's vote counts.

    The storefront exposes no review ratio, so these vote counts are the only
    free source for a dense `review_score`. SteamSpy no longer publishes
    playtime (its fields read 0), so `average_playtime` is derived from the
    review sample in the clean stage instead.
    """
    ranked: list[tuple[int, int]] = []
    stats: dict[int, dict[str, int]] = {}
    try:
        with httpx.Client(timeout=60.0, headers=HEADERS) as client:
            for page in range(0, 6):
                response = client.get(STEAMSPY_PAGE, params={"request": "all", "page": page})
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, dict) or not payload:
                    break
                for appid, row in payload.items():
                    try:
                        aid = int(appid)
                    except (TypeError, ValueError):
                        continue
                    if not isinstance(row, dict):
                        ranked.append((0, aid))
                        continue
                    positive = _int(row.get("positive"))
                    negative = _int(row.get("negative"))
                    stats[aid] = {"positive": positive, "negative": negative}
                    ranked.append((positive + negative, aid))
                time.sleep(1.0)
    except (httpx.HTTPError, ValueError):
        ranked = []

    ranked.sort(reverse=True)
    # Dedupe: a repeated appid inside one upsert batch aborts the whole batch.
    appids = list(dict.fromkeys(appid for _, appid in ranked))
    if not appids:
        appids = list(dict.fromkeys(FALLBACK_APPIDS))
    return appids[: max(limit * 3, limit)], stats


def fetch_appdetails(client: httpx.Client, appid: int) -> dict[str, Any] | None:
    response = client.get(STOREFRONT, params={"appids": appid, "l": "english", "cc": "us"})
    if response.status_code != 200:
        return None
    try:
        payload = response.json()
    except ValueError:
        return None
    entry = payload.get(str(appid)) if isinstance(payload, dict) else None
    if not isinstance(entry, dict) or not entry.get("success"):
        return None
    data = entry.get("data")
    if not isinstance(data, dict) or data.get("type") not in {"game", "dlc"}:
        return None
    if data.get("type") != "game":
        return None
    return data


def to_game_row(data: dict[str, Any], stats: dict[str, int] | None = None) -> dict[str, Any]:
    genres = [g.get("description") for g in data.get("genres") or [] if isinstance(g, dict)]
    tags = [c.get("description") for c in data.get("categories") or [] if isinstance(c, dict)]
    recs = data.get("recommendations") if isinstance(data.get("recommendations"), dict) else {}
    review_count = int(recs.get("total") or 0) if recs else 0
    metacritic = data.get("metacritic") if isinstance(data.get("metacritic"), dict) else {}
    score = metacritic.get("score") if metacritic else None
    developers = data.get("developers") or []
    publishers = data.get("publishers") or []

    stats = stats or {}
    positive = stats.get("positive", 0)
    negative = stats.get("negative", 0)
    votes = positive + negative
    # Metacritic covers only a minority of games; the Steam review ratio is the
    # denser signal, so it wins whenever the sample is big enough to be stable.
    if votes >= 50:
        score = round(100 * positive / votes)
    review_count = max(review_count, votes)

    release_date = _parse_release_date(data.get("release_date"))

    return {
        "steam_appid": int(data.get("steam_appid") or data.get("appid") or 0),
        "name": str(data.get("name") or "").strip(),
        "description": strip_html(data.get("short_description") or data.get("detailed_description")),
        "genres": [g for g in genres if g],
        "developer": ", ".join(str(d) for d in developers) or None,
        "publisher": ", ".join(str(p) for p in publishers) or None,
        "release_date": release_date.isoformat() if release_date else None,
        "header_image_url": data.get("header_image"),
        "capsule_image_url": data.get("capsule_image") or data.get("header_image"),
        "review_score": int(score) if score is not None else None,
        "review_count": review_count,
        "platforms": _platforms(data.get("platforms")),
        "steam_tags": [t for t in tags if t],
        "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=TARGET_GAMES)
    args = parser.parse_args(argv)

    candidates, stats = fetch_popular_appids(args.limit)
    upserted = 0
    batch: list[dict[str, Any]] = []

    supabase = get_client()

    def flush() -> int:
        nonlocal batch
        if not batch:
            return 0
        try:
            supabase.table("games").upsert(batch, on_conflict="steam_appid").execute()
            written = len(batch)
        except Exception as exc:
            print(f"Batch upsert failed ({len(batch)} rows): {exc}")
            written = 0
        batch = []
        return written

    with httpx.Client(timeout=30.0, headers=HEADERS, follow_redirects=True) as client:
        progress = tqdm(candidates, desc="ingest")
        for appid in progress:
            if upserted + len(batch) >= args.limit:
                break
            data = fetch_appdetails(client, appid)
            time.sleep(APPDETAILS_DELAY_S)
            if not data:
                continue
            row = to_game_row(data, stats.get(appid))
            if not row["steam_appid"] or not row["name"]:
                continue
            batch.append(row)
            if len(batch) >= 50:
                upserted += flush()
                progress.set_postfix(upserted=upserted)
        upserted += flush()

    print(f"Upserted {upserted} games")


if __name__ == "__main__":
    main()
