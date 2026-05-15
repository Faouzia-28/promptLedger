"""Utility functions for parsing scorer outputs and fallback heuristics."""
import json
import re
import ast
from typing import Optional


def parse_score_text(text: str) -> Optional[float]:
    if not text or not isinstance(text, str):
        return None
    # Try direct JSON
    try:
        obj = json.loads(text)
        if isinstance(obj, dict) and 'overall' in obj:
            return float(obj['overall'])
    except Exception:
        pass

    # Try to extract JSON-like substring
    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        sub = m.group()
        try:
            obj = json.loads(sub)
            if isinstance(obj, dict) and 'overall' in obj:
                return float(obj['overall'])
        except Exception:
            try:
                obj = ast.literal_eval(sub)
                if isinstance(obj, dict) and 'overall' in obj:
                    return float(obj['overall'])
            except Exception:
                pass

    # Number extraction fallback
    m2 = re.search(r"([0-9]+\.?[0-9]*)", text)
    if m2:
        val = float(m2.group(1))
        if val > 1:
            if val <= 100:
                val = val / 100.0
            elif val <= 10:
                val = val / 10.0
        return max(0.0, min(1.0, val))

    return None


def fallback_heuristic(output: str, expected: str) -> float:
    # Simple lexical overlap heuristic
    if not output:
        return 0.0
    if not expected:
        # fallback to length-based heuristic
        return float(max(0.0, min(1.0, len(output) / 200.0)))

    exp_words = set([w.lower() for w in expected.split() if len(w) > 2])
    act_words = set([w.lower() for w in output.split() if len(w) > 2])
    if exp_words:
        overlap = len(exp_words & act_words) / len(exp_words)
        return float(max(0.0, min(1.0, overlap)))
    return float(max(0.0, min(1.0, len(output) / max(1, len(expected)))))
