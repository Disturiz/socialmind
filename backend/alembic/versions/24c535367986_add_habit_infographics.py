"""add_habit_infographics

Revision ID: 24c535367986
Revises: e1f2a3b4c5d6
Create Date: 2026-07-19 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '24c535367986'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('habit_infographics',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('uploaded_by', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=120), nullable=False),
    sa.Column('description', sa.String(length=500), nullable=True),
    sa.Column('category', sa.String(length=60), nullable=False),
    sa.Column('file_type', sa.String(length=10), nullable=False),
    sa.Column('filename', sa.String(length=255), nullable=False),
    sa.Column('original_name', sa.String(length=255), nullable=False),
    sa.Column('mime_type', sa.String(length=100), nullable=False),
    sa.Column('file_size_bytes', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_habit_infographics_id'), 'habit_infographics', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_habit_infographics_id'), table_name='habit_infographics')
    op.drop_table('habit_infographics')
