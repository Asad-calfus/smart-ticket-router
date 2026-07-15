"""add secondary_teams to tickets and routing_evidence

Revision ID: a7b8c9d0e1f2
Revises: f1a2b3c4d5e6
Create Date: 2026-07-15 00:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Raw SQL (rather than sa.Column(ARRAY(Enum(...)))) so this doesn't try to
    # recreate the already-existing `assigned_team` Postgres enum type.
    op.execute(
        "ALTER TABLE tickets ADD COLUMN secondary_teams assigned_team[] NOT NULL DEFAULT '{}'"
    )
    op.execute(
        "ALTER TABLE routing_evidence ADD COLUMN secondary_teams assigned_team[] NOT NULL DEFAULT '{}'"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("ALTER TABLE routing_evidence DROP COLUMN secondary_teams")
    op.execute("ALTER TABLE tickets DROP COLUMN secondary_teams")
