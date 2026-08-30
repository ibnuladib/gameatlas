import unittest

from pipeline.text import join_capped, strip_html
from pipeline.taxonomy import matched_tags


class NormalizeTests(unittest.TestCase):
    def test_strip_html_removes_markup_and_boilerplate_space(self) -> None:
        raw = "<p>Hello&nbsp;<b>world</b><br/>again</p>"
        cleaned = strip_html(raw)
        self.assertNotIn("<", cleaned)
        self.assertIn("Hello", cleaned)
        self.assertIn("world", cleaned)

    def test_join_capped_does_not_split_mid_word(self) -> None:
        text = join_capped(["alpha beta gamma delta"], 18)
        self.assertTrue(text.endswith("…"))
        self.assertNotIn("delt…", text)

    def test_missing_description_is_empty_not_crash(self) -> None:
        self.assertEqual(strip_html(None), "")

    def test_tag_matching_from_steam_labels(self) -> None:
        tags = {name for name, *_ in matched_tags("action | open world | single-player")}
        self.assertIn("Action", tags)
        self.assertIn("Open World", tags)
        self.assertIn("Single Player", tags)


if __name__ == "__main__":
    unittest.main()
