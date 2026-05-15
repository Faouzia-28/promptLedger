import pytest
from app.utils.score_parser import parse_score_text, fallback_heuristic


@pytest.mark.parametrize(
    "input_text,expected",
    [
        ('{"overall": 0.8}', 0.8),
        ("Overall: {\"overall\":0.9}", 0.9),
        ("{'overall': 0.7}", 0.7),
        ("Score is 80%", 0.8),
        ("No number here", None),
    ],
)
def test_parse_score_text(input_text, expected):
    val = parse_score_text(input_text)
    if expected is None:
        assert val is None
    else:
        assert pytest.approx(val, rel=1e-3) == expected


def test_fallback_heuristic_overlap():
    output = "This is the correct answer with several tokens matching expected output"
    expected = "the correct answer with several tokens"
    score = fallback_heuristic(output, expected)
    assert 0.5 <= score <= 1.0
