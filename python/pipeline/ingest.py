"""Ingest games from Steam and upsert into Supabase.

This script pulls the Steam app list, fetches details for the top ~1,000 games by review count,
and inserts or updates rows in the `games` table.
"""

def main():
    print("Ingest placeholder – implement Steam API fetching and Supabase upserts.")

if __name__ == "__main__":
    main()
