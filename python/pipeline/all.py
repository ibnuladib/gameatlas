"""Run the full offline sequence. Safe to re-run; every stage upserts."""

from __future__ import annotations

from pipeline import clean, embed, ingest, project, reviews, tags


def main() -> None:
    ingest.main()
    reviews.main()
    tags.main()
    clean.main()
    embed.main()
    project.main()


if __name__ == "__main__":
    main()
