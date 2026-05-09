"""LLM Service abstraction layer.

Unified interface to Ollama (local) and Groq (production).
Configurable via LLM_PROVIDER setting in .env.
"""

from app.core.config import settings
import httpx
import json


class LLMService:
    """Unified LLM interface. Uses Ollama locally, Groq in production.
    
    Switch by setting LLM_PROVIDER=ollama or LLM_PROVIDER=groq in .env
    """

    async def chat(
        self, 
        messages: list[dict], 
        temperature: float = 0.1, 
        max_tokens: int = 2000
    ) -> str:
        """Main chat endpoint. Routes to Ollama or Groq based on LLM_PROVIDER."""
        if settings.LLM_PROVIDER == "ollama":
            return await self._ollama_chat(messages, temperature, max_tokens)
        else:
            return await self._groq_chat(messages, temperature, max_tokens)

    async def _ollama_chat(
        self, 
        messages: list[dict], 
        temperature: float, 
        max_tokens: int
    ) -> str:
        """Local Ollama chat endpoint."""
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/chat",
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "messages": messages,
                        "stream": False,
                        "options": {
                            "temperature": temperature,
                            "num_predict": max_tokens,
                        },
                    },
                )
                response.raise_for_status()
                data = response.json()
                return data.get("message", {}).get("content", "")
            except Exception as e:
                raise RuntimeError(f"Ollama error: {str(e)}")

    async def _groq_chat(
        self, 
        messages: list[dict], 
        temperature: float, 
        max_tokens: int
    ) -> str:
        """Groq API chat endpoint."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                    json={
                        "model": settings.GROQ_MODEL,
                        "messages": messages,
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                    },
                )
                response.raise_for_status()
                data = response.json()
                return data.get("choices", [{}])[0].get("message", {}).get("content", "")
            except Exception as e:
                raise RuntimeError(f"Groq error: {str(e)}")

    async def fast_chat(self, messages: list[dict]) -> str:
        """Use the smaller/faster model for quick classification tasks."""
        if settings.LLM_PROVIDER == "ollama":
            async with httpx.AsyncClient(timeout=60.0) as client:
                try:
                    response = await client.post(
                        f"{settings.OLLAMA_BASE_URL}/api/chat",
                        json={
                            "model": settings.OLLAMA_FAST_MODEL,
                            "messages": messages,
                            "stream": False,
                        },
                    )
                    response.raise_for_status()
                    data = response.json()
                    return data.get("message", {}).get("content", "")
                except Exception as e:
                    raise RuntimeError(f"Ollama fast chat error: {str(e)}")
        else:
            async with httpx.AsyncClient(timeout=30.0) as client:
                try:
                    response = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                        json={
                            "model": "gemma-7b-it",
                            "messages": messages,
                            "max_tokens": 500,
                        },
                    )
                    response.raise_for_status()
                    data = response.json()
                    return data.get("choices", [{}])[0].get("message", {}).get("content", "")
                except Exception as e:
                    raise RuntimeError(f"Groq fast chat error: {str(e)}")


# Singleton instance
llm = LLMService()
