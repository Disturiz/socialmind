"""add_specialist_assignments

Revision ID: c8d9e0f1a2b3
Revises: f3a2c1b9d0e8
Create Date: 2026-07-11

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c8d9e0f1a2b3'
down_revision: Union[str, None] = 'f3a2c1b9d0e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'specialist_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('specialist_id', sa.Integer(), nullable=False),
        sa.Column('child_profile_id', sa.Integer(), nullable=False),
        sa.Column('assigned_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['specialist_id'], ['users.id']),
        sa.ForeignKeyConstraint(['child_profile_id'], ['child_profiles.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('specialist_id', 'child_profile_id', name='uq_specialist_child'),
    )
    op.create_index(
        op.f('ix_specialist_assignments_id'), 'specialist_assignments', ['id'], unique=False
    )
    # Seed de compatibilidad: asignar todos los especialistas existentes a todos los niños existentes
    op.execute("""
        INSERT INTO specialist_assignments (specialist_id, child_profile_id, assigned_at)
        SELECT u.id, cp.id, CURRENT_TIMESTAMP
        FROM users u CROSS JOIN child_profiles cp
        WHERE u.role = 'specialist'
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.drop_index(op.f('ix_specialist_assignments_id'), table_name='specialist_assignments')
    op.drop_table('specialist_assignments')
