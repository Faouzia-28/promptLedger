"""LLM Service abstraction layer.

Unified interface to Ollama (local) and Groq (production).
Configurable via LLM_PROVIDER setting in .env.
"""

from app.core.config import settings
import httpx
import json
import asyncio
import time

try:
    from app.core.observability import SCORE_LATENCY, SCORE_CALLS
except Exception:
    SCORE_LATENCY = None
    SCORE_CALLS = None


class LLMService:
    """Unified LLM interface. Uses Ollama locally, Groq in production.
    
    Switch by setting LLM_PROVIDER=ollama or LLM_PROVIDER=groq in .env
    """

    async def chat(
        self, 
        messages: list[dict], 
        temperature: float = 0.1, 
        max_tokens: int = 2000,
        provider: str | None = None,
    ) -> str:
        """Main chat endpoint. Routes to Ollama or Groq based on LLM_PROVIDER."""
        effective_provider = provider or settings.LLM_PROVIDER
        if effective_provider == "ollama":
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
            payload = {
                "model": settings.GROQ_MODEL,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            # Retry on 429 with simple exponential backoff
            for attempt in range(1, 4):
                try:
                    start = time.time()
                    response = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                        json=payload,
                    )
                    elapsed = time.time() - start
                    if SCORE_CALLS is not None and SCORE_LATENCY is not None:
                        try:
                            SCORE_CALLS.inc()
                            SCORE_LATENCY.observe(elapsed)
                        except Exception:
                            pass
                    # Log raw response json for debugging
                    try:
                        data = response.json()
                    except Exception:
                        data = None
                    print(f"[GROQ RESPONSE] status={response.status_code} json={data}")
                    response.raise_for_status()
                    data = response.json()
                    return data.get("choices", [{}])[0].get("message", {}).get("content", "")
                except httpx.HTTPStatusError as e:
                    status = e.response.status_code if e.response is not None else None
                    if status == 429 and attempt < 3:
                        backoff = 0.5 * (2 ** (attempt - 1))
                        print(f"[GROQ] 429 received, backing off {backoff}s (attempt {attempt})")
                        await asyncio.sleep(backoff)
                        continue
                    print(f"[GROQ] falling back to Ollama after HTTP {status}: {e}")
                    break
                except Exception as e:
                    print(f"[GROQ] falling back to Ollama after error: {e}")
                    break

        try:
            return await self._ollama_chat(messages, temperature, max_tokens)
        except Exception as fallback_error:
            raise RuntimeError(f"Groq error: {fallback_error}")

    async def fast_chat(self, messages: list[dict]) -> str:
        """Use the smaller/faster model for quick classification tasks."""
        return await self.fast_chat_with_provider(messages)

    async def fast_chat_with_provider(self, messages: list[dict], provider: str | None = None) -> str:
        """Use the smaller/faster model for quick classification tasks."""
        effective_provider = provider or settings.LLM_PROVIDER
        if effective_provider == "ollama":
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
                    try:
                        return await self._ollama_chat(messages, temperature=0.0, max_tokens=500)
                    except Exception:
                        raise RuntimeError(f"Groq fast chat error: {str(e)}")


# Singleton instance
llm = LLMService()
