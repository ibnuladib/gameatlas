"""Supabase REST client for the offline pipeline."""

from __future__ import annotations

from supabase import create_client, Client

from pipeline.config import SUPABASE_URL, SUPABASE_KEY


def get_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise SystemExit(
            "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. "
            "Ensure they are in your .env.local file."
        )
    # Use the service role key to bypass RLS for admin pipeline operations
    return create_client(SUPABASE_URL, SUPABASE_KEY)


PAGE_SIZE = 1000


def fetch_all(client: Client, table: str, columns: str, order: str = "id") -> list[dict]:
    """Read an entire table.

    PostgREST caps an unbounded select at 1000 rows and gives no indication it
    truncated, so every full-table read in the pipeline must page explicitly.
    """
    rows: list[dict] = []
    start = 0
    while True:
        response = (
            client.table(table)
            .select(columns)
            .order(order)
            .range(start, start + PAGE_SIZE - 1)
            .execute()
        )
        page = response.data or []
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            return rows
        start += PAGE_SIZE

