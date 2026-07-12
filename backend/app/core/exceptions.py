"""Domain exceptions and their FastAPI handlers.

Keeping these separate from business logic means services can raise a plain
`NotFoundError("customer 999 not found")` without importing FastAPI, and the
API layer decides how that becomes an HTTP response.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("app")


class NotFoundError(Exception):
    """Raised when a referenced record (customer, ticket, ...) does not exist."""


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(NotFoundError)
    async def handle_not_found(request: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        # Never leak raw provider/database errors (may contain internal details or secrets).
        logger.exception("Unhandled error while processing %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "An unexpected error occurred. Please try again."})
