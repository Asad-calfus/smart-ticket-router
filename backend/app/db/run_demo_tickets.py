"""Runs every seeded demo ticket (the ones with status=Open) through the real
routing service and prints a summary table — the easiest way to see the
router's behaviour across all the demo edge cases in one go.

Run with (from backend/, venv active, database seeded and embeddings backfilled):

    python -m app.db.run_demo_tickets
"""

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Customer, Ticket
from app.models.enums import TicketStatus
from app.schemas.ticket import TicketRouteRequest
from app.services.routing_service import route_ticket_request


def _truncate(text: str, length: int = 60) -> str:
    text = " ".join(text.split())
    return text if len(text) <= length else text[: length - 3] + "..."


def run() -> None:
    session = SessionLocal()
    try:
        demo_tickets = list(
            session.execute(
                select(Ticket).where(Ticket.status == TicketStatus.OPEN).order_by(Ticket.id)
            ).scalars().all()
        )

        if not demo_tickets:
            print("No open demo tickets found — run `python -m app.db.seed` first.")
            return

        print(f"Routing {len(demo_tickets)} demo tickets...\n")
        header = f"{'ID':>4}  {'Customer':<16} {'Category':<20} {'Priority':<8} {'Team':<22} {'Conf.':>6}  {'Review?':<7}  Message"
        print(header)
        print("-" * len(header))

        failures = 0
        for ticket in demo_tickets:
            customer = session.get(Customer, ticket.customer_id)
            payload = TicketRouteRequest(
                customer_id=ticket.customer_id,
                message=ticket.message,
                channel=ticket.channel,
                ticket_id=ticket.id,
            )
            try:
                result = route_ticket_request(session, payload)
            except Exception as exc:  # noqa: BLE001 - a demo run should report failures, not crash
                failures += 1
                print(f"{ticket.id:>4}  {customer.name:<16} FAILED: {exc}")
                continue

            print(
                f"{result.ticket_id:>4}  {customer.name:<16} {result.category.value:<20} "
                f"{result.priority.value:<8} {result.assigned_team.value:<22} "
                f"{result.confidence:>5.2f}  {'yes' if result.needs_human_review else 'no':<7}  "
                f"{_truncate(ticket.message)}"
            )

        print(f"\nDone. {len(demo_tickets) - failures}/{len(demo_tickets)} routed successfully.")
    finally:
        session.close()


if __name__ == "__main__":
    run()
