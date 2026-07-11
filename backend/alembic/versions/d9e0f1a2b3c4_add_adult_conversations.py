"""add_adult_conversations

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
Create Date: 2026-07-11

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd9e0f1a2b3c4'
down_revision: Union[str, None] = 'c8d9e0f1a2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'adult_conversations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_adult_conversations_id'), 'adult_conversations', ['id'], unique=False
    )

    op.create_table(
        'adult_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('conversation_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['adult_conversations.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_adult_messages_id'), 'adult_messages', ['id'], unique=False
    )
    op.create_index(
        'ix_adult_messages_conv_created', 'adult_messages',
        ['conversation_id', 'created_at'], unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_adult_messages_conv_created', table_name='adult_messages')
    op.drop_index(op.f('ix_adult_messages_id'), table_name='adult_messages')
    op.drop_table('adult_messages')
    op.drop_index(op.f('ix_adult_conversations_id'), table_name='adult_conversations')
    op.drop_table('adult_conversations')
