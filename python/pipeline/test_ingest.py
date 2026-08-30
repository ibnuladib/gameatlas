import unittest

from pipeline.ingest import to_game_row

BASE = {
    "steam_appid": 570,
    "name": "Dota 2",
    "short_description": "<p>A MOBA.</p>",
    "genres": [{"description": "Action"}, {"description": "Strategy"}],
    "categories": [{"description": "Multi-player"}],
    "platforms": {"windows": True, "mac": False, "linux": True},
    "header_image": "https://cdn.example/header.jpg",
}


class GameRowTests(unittest.TestCase):
    def test_steam_ratio_supplies_review_score_when_metacritic_is_absent(self) -> None:
        row = to_game_row(BASE, {"positive": 900, "negative": 100, "average_forever": 0})
        self.assertEqual(row["review_score"], 90)
        self.assertEqual(row["review_count"], 1000)

    def test_steam_ratio_overrides_metacritic(self) -> None:
        row = to_game_row({**BASE, "metacritic": {"score": 74}}, {"positive": 900, "negative": 100})
        self.assertEqual(row["review_score"], 90)

    def test_tiny_vote_sample_falls_back_to_metacritic(self) -> None:
        row = to_game_row({**BASE, "metacritic": {"score": 74}}, {"positive": 3, "negative": 1})
        self.assertEqual(row["review_score"], 74)

    def test_ingest_never_writes_playtime(self) -> None:
        # The clean stage derives it from reviews; ingest must not clobber that.
        self.assertNotIn("average_playtime", to_game_row(BASE, {"positive": 900, "negative": 100}))

    def test_missing_steamspy_stats_do_not_crash(self) -> None:
        row = to_game_row(BASE, None)
        self.assertIsNone(row["review_score"])
        self.assertEqual(row["name"], "Dota 2")

    def test_review_score_stays_within_the_schema_check_constraint(self) -> None:
        for positive, negative in ((1000, 0), (0, 1000), (500, 500)):
            score = to_game_row(BASE, {"positive": positive, "negative": negative})["review_score"]
            self.assertGreaterEqual(score, 0)
            self.assertLessEqual(score, 100)

    def test_platforms_keep_only_supported_targets(self) -> None:
        self.assertEqual(to_game_row(BASE, None)["platforms"], ["windows", "linux"])

    def test_html_is_stripped_from_the_description(self) -> None:
        self.assertNotIn("<", to_game_row(BASE, None)["description"])


if __name__ == "__main__":
    unittest.main()
