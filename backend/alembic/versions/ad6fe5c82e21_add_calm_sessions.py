"""add_calm_sessions

Revision ID: ad6fe5c82e21
Revises: 7f80cb65752d
Create Date: 2026-06-17 14:51:43.579283

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'ad6fe5c82e21'
down_revision: Union[str, None] = '7f80cb65752d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('calm_sessions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('activity_type', sa.String(length=20), nullable=False),
    sa.Column('duration_seconds', sa.Integer(), nullable=False),
    sa.Column('emotion_key', sa.String(length=50), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_calm_sessions_id'), 'calm_sessions', ['id'], unique=False)
    op.create_index('ix_calm_sessions_user_created', 'calm_sessions', ['user_id', 'created_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_calm_sessions_user_created', table_name='calm_sessions')
    op.drop_index(op.f('ix_calm_sessions_id'), table_name='calm_sessions')
    op.drop_table('calm_sessions')
