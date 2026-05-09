"""Embedding Service for local text embeddings.

Uses sentence-transformers all-MiniLM-L6-v2 model.
384 dimensions, fully offline, no API needed.
"""

from sentence_transformers import SentenceTransformer
import numpy as np


class EmbedService:
    """Local embeddings using sentence-transformers all-MiniLM-L6-v2.
    
    384 dimensions, runs fully offline, no API needed ever.
    """

    def __init__(self):
        self._model = None  # lazy load

    @property
    def model(self):
        """Lazy-load the model on first access."""
        if self._model is None:
            self._model = SentenceTransformer("all-MiniLM-L6-v2")
        return self._model

    def embed(self, text: str) -> list[float]:
        """Embed a single text string."""
        vec = self.model.encode(text, normalize_embeddings=True)
        return vec.tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed multiple text strings efficiently."""
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
