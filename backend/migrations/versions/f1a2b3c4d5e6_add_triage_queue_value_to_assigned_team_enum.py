"""add triage queue value to assigned_team enum

Revision ID: f1a2b3c4d5e6
Revises: b3f1a9d7c2e4
Create Date: 2026-07-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'b3f1a9d7c2e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Postgres can't ADD VALUE to an enum type inside a regular transaction block,
    # so this runs in its own autocommit block, separate from other DDL.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE assigned_team ADD VALUE IF NOT EXISTS 'Triage Queue'")


def downgrade() -> None:
    """Downgrade schema."""
    # Postgres has no ALTER TYPE ... DROP VALUE. Reversing this would require
    # rebuilding the enum type from scratch, which risks any Triage Queue rows
    # that exist by the time of a downgrade — left as a manual, deliberate operation.
    raise NotImplementedError(
        "Downgrading the 'Triage Queue' assigned_team value requires a manual data migration."
    )
