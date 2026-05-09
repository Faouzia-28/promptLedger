"""Base agent class with common utilities."""
import json
import numpy as np
from typing import Optional
from app.services.llm_service import llm
from app.services.embed_service import embedder


class BaseAgent:
    """Base class for all agents with shared utilities."""

    async def _run_version(self, version, input_text: str) -> str:
        """Run a prompt version against input text using LLMService."""
        if version.model_config.get('use_ollama', True):
            provider = "ollama"
        else:
            provider = "groq"
        
        # Extract system prompt and user prompt from version content
        content = version.content if isinstance(version.content, dict) else json.loads(version.content or '{}')
        system_prompt = content.get('system_prompt') or content.get('system_message', '')
        user_template = content.get('prompt') or content.get('user_prompt', '{input}')
        
        # Format user message
        user_message = user_template.format(input=input_text)
        
        # Build messages
        messages = []
        if system_prompt:
            messages.append({'role': 'system', 'content': system_prompt})
        messages.append({'role': 'user', 'content': user_message})
        
        # Call LLM
        result = await llm.chat(messages, temperature=0.1, max_tokens=2000)
        return result

    async def _count_refusals(self, outputs: list[str]) -> int:
        """Count how many outputs are refusals."""
        refusal_keywords = ['cannot', 'cannot', 'unable', 'can\'t', 'inappropriate', 'policy', 'not able']
        count = 0
        for output in outputs:
            lower = output.lower()
            if any(kw in lower for kw in refusal_keywords):
                count += 1
        return count

    def _parse_json(self, text: str, default: dict = None) -> dict:
        """Safely parse JSON from LLM output."""
        if default is None:
            default = {}
        try:
            # Try to extract JSON if wrapped in markdown
            if '```' in text:
                text = text.split('```')[1]
                if text.startswith('json'):
                    text = text[4:]
            return json.loads(text.strip())
        except:
            return default
