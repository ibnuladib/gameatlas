"""Shared pipeline settings. Secrets come from env / .env.local — never hardcoded."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

STEAM_API_KEY = os.environ.get("STEAM_API_KEY", "")

EMBED_MODEL = os.environ.get("EMBED_MODEL", "BAAI/bge-small-en-v1.5")
EMBED_MODEL_VERSION = os.environ.get("EMBED_MODEL_VERSION", "v1.5")
PROJECTION_VERSION = os.environ.get("PROJECTION_VERSION", "umap-bge-small-v1")
TARGET_GAMES = int(os.environ.get("PIPELINE_TARGET_GAMES", "2000"))
REVIEWS_PER_GAME = int(os.environ.get("PIPELINE_REVIEWS_PER_GAME", "8"))
APPDETAILS_DELAY_S = float(os.environ.get("PIPELINE_APPDETAILS_DELAY_S", "1.6"))
DOCUMENT_CHAR_CAP = 8000
