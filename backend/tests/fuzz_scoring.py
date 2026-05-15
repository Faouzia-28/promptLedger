"""Simple fuzz harness for scoring components.

This does not require a running DB or LLM; it exercises parsing and fallback heuristics.
"""
from app.utils.score_parser import parse_score_text, fallback_heuristic


SAMPLES = [
    '{"overall":0.95}',
    "{'overall': 0.6}",
    'Score: 85%',
    'Completely unrelated text',
    '{invalid json}',
]


def test_fuzz_samples():
    expected = 'the correct answer'
    for s in SAMPLES:
        parsed = parse_score_text(s)
        if parsed is None:
            fb = fallback_heuristic('some output here', expected)
            assert 0.0 <= fb <= 1.0
        else:
            assert 0.0 <= parsed <= 1.0
