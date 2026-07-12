"""Turns ticket/document text into vectors for pgvector similarity search.

Two providers, chosen by EMBEDDING_PROVIDER in .env:

- "mock" (default): a deterministic, dependency-free hashed bag-of-words
  vector. Tokens are hashed into fixed positions and counted, then
  L2-normalized. This is NOT real semantic search — it only captures literal
  word overlap (no synonyms, no meaning). Two tickets that use different
  words for the same problem will NOT be scored as similar. It exists so the
  whole app runs with zero API keys; treat its "similar tickets" as a rough
  demo, not a claim of real understanding.

- "openai": calls the real OpenAI embeddings API (requires OPENAI_API_KEY),
  requesting `settings.embedding_dim` dimensions so the vector always fits
  the column regardless of provider.

Both paths return a plain list[float] of length settings.embedding_dim, so
callers never need to know which provider produced it.
"""

import hashlib
import logging
import math
import re

from app.core.config import settings

logger = logging.getLogger("app")

_TOKEN_RE = re.compile(r"[^\W\d_]+", re.UNICODE)

# Common English filler words, dropped so the mock embedding's limited "bag of words"
# signal isn't swamped by words nearly every ticket shares. Deliberately small and
# English-only — this is a demo heuristic, not a real multilingual NLP pipeline.
_STOPWORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "i", "you", "he", "she", "it", "we", "they", "me", "my", "your", "our",
    "this", "that", "these", "those", "and", "or", "but", "if", "so", "to",
    "of", "in", "on", "at", "for", "with", "as", "by", "from", "not", "no",
    "do", "does", "did", "can", "could", "will", "would", "should", "have",
    "has", "had", "am", "im", "there", "here", "what", "when", "why", "how",
}


def _tokenize(text: str) -> list[str]:
    return [token for token in _TOKEN_RE.findall(text.lower()) if token not in _STOPWORDS]


def _mock_embedding(text: str, dim: int) -> list[float]:
    vector = [0.0] * dim
    tokens = _tokenize(text)
    for token in tokens:
        index = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16) % dim
        vector[index] += 1.0
    norm = math.sqrt(sum(component * component for component in vector))
    if norm > 0:
        vector = [component / norm for component in vector]
    return vector


def _openai_embedding(text: str) -> list[float]:
    from openai import OpenAI  # imported lazily so mock mode never needs the package installed

    client = OpenAI(api_key=settings.openai_api_key)
    response = client.embeddings.create(
        model=settings.embedding_model,
        input=text,
        dimensions=settings.embedding_dim,
    )
    return list(response.data[0].embedding)


def get_embedding(text: str) -> list[float]:
    """Returns a length-`settings.embedding_dim` embedding for `text`.

    Falls back to the mock embedding if the real provider errors out, so an
    embedding API outage never crashes the request.
    """
    if settings.embedding_provider == "openai" and settings.openai_api_key:
        try:
            return _openai_embedding(text)
        except Exception:
            logger.exception("OpenAI embedding call failed; falling back to the mock embedding for this request.")
            return _mock_embedding(text, settings.embedding_dim)
    return _mock_embedding(text, settings.embedding_dim)
