"""Embedding Service for local text embeddings.

Uses sentence-transformers when available, with a lightweight NumPy fallback
so the backend can start without the heavy ML dependency chain.
"""

import hashlib
import re

import numpy as np

try:
    from sentence_transformers import SentenceTransformer
except ImportError:  # pragma: no cover - optional dependency fallback
    SentenceTransformer = None


class EmbedService:
    """Local embeddings using sentence-transformers all-MiniLM-L6-v2.
    
    384 dimensions, runs fully offline, no API needed ever.
    """

    def __init__(self):
        self._model = None  # lazy load

    @property
    def model(self):
        """Lazy-load the model on first access."""
        if SentenceTransformer is None:
            return None

        if self._model is None:
            self._model = SentenceTransformer("all-MiniLM-L6-v2")
        return self._model

    def _fallback_embed(self, text: str) -> list[float]:
        """Deterministic 384-dim embedding without external model dependencies."""
        vector = np.zeros(384, dtype=np.float32)
        tokens = re.findall(r"\w+", text.lower())

        if not tokens:
            return vector.tolist()

        for token in tokens:
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % 384
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vector[index] += sign

        norm = np.linalg.norm(vector)
        if norm > 0:
            vector = vector / norm

        return vector.tolist()

    def embed(self, text: str) -> list[float]:
        """Embed a single text string."""
        if self.model is None:
            return self._fallback_embed(text)

        vec = self.model.encode(text, normalize_embeddings=True)
        return vec.tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple text strings efficiently."""
        if self.model is None:
            return [self._fallback_embed(text) for text in texts]

        vecs = self.model.encode(texts, normalize_embeddings=True, batch_size=32)
        return vecs.tolist()

    def cosine_distance(self, a: list[float], b: list[float]) -> float:
        """Compute cosine distance between two embedding vectors."""
        va = np.array(a)
        vb = np.array(b)
        # Distance = 1 - similarity
        return float(1.0 - np.dot(va, vb) / (np.linalg.norm(va) * np.linalg.norm(vb) + 1e-8))

    def centroid(self, embeddings: list[list[float]]) -> list[float]:
        """Compute the centroid (mean) of a list of embeddings."""
        if not embeddings:
            return [0.0] * 384
        return np.mean(np.array(embeddings), axis=0).tolist()


# Singleton instance
embedder = EmbedService()
