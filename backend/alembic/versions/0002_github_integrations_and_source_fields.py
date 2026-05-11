"""github_integrations_and_source_fields

Revision ID: 0002_github_integrations_and_source_fields
Revises: 0001_initial_schema
Create Date: 2026-05-11
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0002_github_integrations_and_source_fields"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("behavior_versions", sa.Column("source_provider", sa.String(), nullable=False, server_default=sa.text("'manual'")))
    op.add_column("behavior_versions", sa.Column("source_repo", sa.String(), nullable=True))
    op.add_column("behavior_versions", sa.Column("source_path", sa.String(), nullable=True))
    op.add_column("behavior_versions", sa.Column("source_ref", sa.String(), nullable=True))
    op.add_column("behavior_versions", sa.Column("source_sha", sa.String(), nullable=True))

    op.create_table(
        "github_integrations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("unit_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("behavior_units.id", ondelete="SET NULL"), nullable=True),
        sa.Column("repo_full_name", sa.String(), nullable=False),
        sa.Column("default_branch", sa.String(), nullable=False, server_default=sa.text("'main'")),
        sa.Column("tracked_paths", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("org_id", "repo_full_name", name="uq_github_integrations_org_repo"),
    )

    op.create_table(
        "github_sync_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("integration_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("github_integrations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("unit_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("behavior_units.id", ondelete="SET NULL"), nullable=True),
        sa.Column("version_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("behavior_versions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("branch", sa.String(), nullable=True),
        sa.Column("commit_sha", sa.String(), nullable=True),
        sa.Column("file_path", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default=sa.text("'received'")),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )


def downgrade() -> None:
    op.drop_table("github_sync_events")
    op.drop_table("github_integrations")
    op.drop_column("behavior_versions", "source_sha")
    op.drop_column("behavior_versions", "source_ref")
    op.drop_column("behavior_versions", "source_path")
    op.drop_column("behavior_versions", "source_repo")
    op.drop_column("behavior_versions", "source_provider")