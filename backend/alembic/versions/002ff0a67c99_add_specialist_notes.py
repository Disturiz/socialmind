"""add_specialist_notes

Revision ID: 002ff0a67c99
Revises: ad6fe5c82e21
Create Date: 2026-06-17 18:20:24.404848

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '002ff0a67c99'
down_revision: Union[str, None] = 'ad6fe5c82e21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('specialist_notes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('specialist_id', sa.Integer(), nullable=False),
    sa.Column('child_profile_id', sa.Integer(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['child_profile_id'], ['child_profiles.id'], ),
    sa.ForeignKeyConstraint(['specialist_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('specialist_id', 'child_profile_id', name='uq_note_specialist_child')
    )
    op.create_index(op.f('ix_specialist_notes_id'), 'specialist_notes', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_specialist_notes_id'), table_name='specialist_notes')
    op.drop_table('specialist_notes')
