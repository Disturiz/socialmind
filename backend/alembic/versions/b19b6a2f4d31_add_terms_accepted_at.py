"""add_terms_accepted_at

Revision ID: b19b6a2f4d31
Revises: 24c535367986
Create Date: 2026-07-21

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b19b6a2f4d31'
down_revision: Union[str, None] = '24c535367986'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('terms_accepted_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'terms_accepted_at')
