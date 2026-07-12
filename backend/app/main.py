import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, customers, incidents, metrics, tickets
from app.core.config import settings
from app.core.exceptions import register_exception_handlers

# Ensures app.* loggers (e.g. app.dev_email, which "sends" dev-mode auth
# emails to the log) actually emit — uvicorn only configures its own loggers
# by default, and the root logger's default level (WARNING) would otherwise
# silently swallow our INFO-level dev-email log lines.
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title="Smart Support Ticket Router")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(tickets.router)
app.include_router(incidents.router)
app.include_router(metrics.router)


@app.get("/health")
def health():
    return {"status": "ok"}
