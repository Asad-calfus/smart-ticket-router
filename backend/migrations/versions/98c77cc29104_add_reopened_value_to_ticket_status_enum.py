"""add reopened value to ticket_status enum

Revision ID: 98c77cc29104
Revises: 793849ed5e84
Create Date: 2026-07-12 08:46:57.775218

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '98c77cc29104'
down_revision: Union[str, Sequence[str], None] = '793849ed5e84'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Postgres can't ADD VALUE to an enum type inside a regular transaction block,
    # so this runs in its own autocommit block, separate from other DDL.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'Reopened'")


def downgrade() -> None:
    """Downgrade schema."""
    # Postgres has no ALTER TYPE ... DROP VALUE. Reversing this would require
    # rebuilding the enum type from scratch, which risks any Reopened rows that
    # exist by the time of a downgrade — left as a manual, deliberate operation.
    raise NotImplementedError(
        "Downgrading the 'Reopened' ticket_status value requires a manual data migration."
    )
