"""Runs every seeded demo ticket (status=Open) through the routing service and
checks each result is schema-valid. Uses routing_service.route_ticket directly
(the non-persisting computation) so this test never mutates ticket rows other
tests rely on — see app/db/run_demo_tickets.py for the human-readable version
that persists results and prints a summary table.
"""

from sqlalchemy import select

from app.models import Ticket
from app.models.enums import TicketStatus
from app.schemas.ticket import RoutingResult
from app.services.routing_service import route_ticket


def test_all_demo_tickets_route_successfully_and_validate(db_session):
    demo_tickets = list(
        db_session.execute(select(Ticket).where(Ticket.status == TicketStatus.OPEN).order_by(Ticket.id)).scalars().all()
    )

    assert len(demo_tickets) >= 20, "expected at least 20 seeded demo tickets"

    for ticket in demo_tickets:
        outcome = route_ticket(db_session, ticket.customer_id, ticket.message)
        RoutingResult.model_validate(outcome.result.model_dump())
        assert outcome.result.category is not None
        assert outcome.result.assigned_team is not None
