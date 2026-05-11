"""add github access token to github integrations

Revision ID: 0003_github_access_token_column
Revises: 0002_github_integrations_and_source_fields
Create Date: 2026-05-11 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0003_github_access_token_column"
down_revision = "0002_github_integrations_and_source_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("github_integrations", sa.Column("github_access_token", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("github_integrations", "github_access_token")
