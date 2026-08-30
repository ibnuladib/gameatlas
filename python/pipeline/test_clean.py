import unittest

from pipeline.clean import build_document, playtime_estimate


class PlaytimeEstimateTests(unittest.TestCase):
    def test_median_ignores_a_single_extreme_outlier(self) -> None:
        # One 5,000-hour reviewer must not define the estimate for everyone else.
        self.assertEqual(playtime_estimate([600, 700, 800, 300000]), 750)

    def test_too_small_a_sample_yields_no_estimate(self) -> None:
        self.assertIsNone(playtime_estimate([600, 700]))

    def test_zero_and_missing_playtimes_are_discarded(self) -> None:
        self.assertIsNone(playtime_estimate([0, 0, 0, 0]))

    def test_no_reviews_yields_no_estimate(self) -> None:
        self.assertIsNone(playtime_estimate([]))

    def test_estimate_stays_in_minutes(self) -> None:
        self.assertEqual(playtime_estimate([60, 120, 180]), 120)


class BuildDocumentTests(unittest.TestCase):
    def test_document_includes_name_genres_and_tags(self) -> None:
        doc = build_document(
            {
                "name": "Hollow Knight",
                "description": "<p>A metroidvania.</p>",
                "genres": ["Action", "Adventure"],
                "steam_tags": ["Single-player"],
                "review_excerpts": ["Great atmosphere"],
            }
        )
        self.assertIn("Hollow Knight", doc)
        self.assertIn("Action", doc)
        self.assertIn("Single-player", doc)
        self.assertIn("Great atmosphere", doc)
        self.assertNotIn("<p>", doc)

    def test_game_with_no_reviews_still_produces_a_document(self) -> None:
        doc = build_document({"name": "Obscure Game", "description": None, "genres": [], "steam_tags": []})
        self.assertIn("Obscure Game", doc)


if __name__ == "__main__":
    unittest.main()
