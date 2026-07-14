"""add routing evidence token usage

Revision ID: 4c8ed12c78d0
Revises: 85c9f05e45d9
Create Date: 2026-07-13 22:12:15.555068

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c8ed12c78d0'
down_revision: Union[str, Sequence[str], None] = '85c9f05e45d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('routing_evidence', sa.Column('input_tokens', sa.Integer(), nullable=True))
    op.add_column('routing_evidence', sa.Column('output_tokens', sa.Integer(), nullable=True))
    op.add_column('routing_evidence', sa.Column('total_tokens', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('routing_evidence', 'total_tokens')
    op.drop_column('routing_evidence', 'output_tokens')
    op.drop_column('routing_evidence', 'input_tokens')
