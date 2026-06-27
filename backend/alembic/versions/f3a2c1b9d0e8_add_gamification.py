"""add_gamification

Revision ID: f3a2c1b9d0e8
Revises: 8c779fde6714
Create Date: 2026-06-27

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f3a2c1b9d0e8'
down_revision: Union[str, None] = '8c779fde6714'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'reward_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=30), nullable=False),
        sa.Column('stars_earned', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('extra_data', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_reward_events_id'), 'reward_events', ['id'], unique=False)
    op.create_index('ix_reward_events_user_created', 'reward_events', ['user_id', 'created_at'], unique=False)

    op.create_table(
        'user_rewards',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('total_stars', sa.Integer(), nullable=False),
        sa.Column('current_level_key', sa.String(length=30), nullable=False),
        sa.Column('current_streak', sa.Integer(), nullable=False),
        sa.Column('last_activity_date', sa.Date(), nullable=True),
        sa.Column('badges', sa.JSON(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    op.create_index(op.f('ix_user_rewards_id'), 'user_rewards', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_rewards_id'), table_name='user_rewards')
    op.drop_table('user_rewards')
    op.drop_index('ix_reward_events_user_created', table_name='reward_events')
    op.drop_index(op.f('ix_reward_events_id'), table_name='reward_events')
    op.drop_table('reward_events')
