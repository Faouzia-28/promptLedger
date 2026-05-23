"""Utilities to validate prompt content and detect config-like prompts."""
import json
from typing import Any


def looks_like_config(value: Any) -> bool:
    """Return True if the provided prompt value looks like a model/config JSON blob.

    Heuristics:
    - If it's a dict -> likely config
    - If it's a string that parses as a dict and contains suspicious keys like
      'model', 'temperature', 'max_tokens', 'system_prompt', etc.
    - If it's a string that contains both 'temperature' and 'model' or similar
      key names (case-insensitive).
    """
    if value is None:
        return False
    # Dicts are almost certainly config objects
    if isinstance(value, dict):
        return True

    if isinstance(value, str):
        s = value.strip()
        if not s:
            return False
        # If it looks like JSON, try parse
        if s.startswith('{') or s.startswith('['):
            try:
                obj = json.loads(s)
                if isinstance(obj, dict):
                    keys = set(k.lower() for k in obj.keys())
                    suspicious = {'model', 'temperature', 'max_tokens', 'system_prompt', 'user_prompt', 'provider', 'model_config'}
                    if keys & suspicious:
                        return True
            except Exception:
                # Not valid JSON; fall through to substring heuristics
                pass

        lowered = s.lower()
        # common indicators of embedded config
        if 'temperature' in lowered and ('model' in lowered or 'max_tokens' in lowered):
            return True
        if 'model:' in lowered or 'temperature:' in lowered or 'max_tokens:' in lowered:
            return True

    return False


def validate_prompt_content(content: Any) -> tuple[bool, str]:
    """Validate a content object (usually a dict or prompt text).

    Returns (is_invalid, message). If is_invalid is True, the caller should reject
    the request and surface `message` to the user.
    """
    # content may be a dict containing 'prompt' or a raw prompt string
    if isinstance(content, dict):
        prompt_val = content.get('prompt') or content.get('text') or content.get('user_prompt')
        if looks_like_config(prompt_val):
            return True, (
                "The 'prompt' field appears to contain model configuration JSON (e.g. 'model' or 'temperature'). "
                "Move runtime configuration into the 'config' field and set 'prompt' to the task instruction."
            )
        # If top-level dict itself looks like a config (e.g., full model config provided)
        if looks_like_config(content):
            return True, (
                "The provided content looks like a model configuration object rather than a task prompt. "
                "Place configuration in 'config' and provide a plain text 'prompt' for the task."
            )
        return False, ''

    # If content is a string, just check it
    if looks_like_config(content):
        return True, (
            "The prompt appears to contain JSON-like model configuration (e.g. 'temperature' or 'model'). "
            "Use the 'config' field for model settings and keep 'prompt' as the task instruction."
        )

    return False, ''
