"""add reasoning_effort to user llm settings

Revision ID: b3f1a9d7c2e4
Revises: 85c9f05e45d9
Create Date: 2026-07-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3f1a9d7c2e4'
down_revision: Union[str, Sequence[str], None] = '4c8ed12c78d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('user_llm_settings', sa.Column('reasoning_effort', sa.String(length=20), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user_llm_settings', 'reasoning_effort')
