from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import customers, incidents, metrics, tickets
from app.core.config import settings
from app.core.exceptions import register_exception_handlers

app = FastAPI(title="Smart Support Ticket Router")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(customers.router)
app.include_router(tickets.router)
app.include_router(incidents.router)
app.include_router(metrics.router)


@app.get("/health")
def health():
    return {"status": "ok"}
