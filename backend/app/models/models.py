from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True, index=True)
    plan = Column(String, nullable=False, default="free")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    behavior_units = relationship("BehaviorUnit", back_populates="organization", cascade="all, delete-orphan")
    eval_sets = relationship("EvalSet", back_populates="organization", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="organization", cascade="all, delete-orphan")
    alert_configs = relationship("AlertConfig", back_populates="organization", cascade="all, delete-orphan")
    github_integrations = relationship("GitHubIntegration", back_populates="organization", cascade="all, delete-orphan")
    github_sync_events = relationship("GitHubSyncEvent", back_populates="organization", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String, nullable=False, unique=True, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="member")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    organization = relationship("Organization", back_populates="users")
    created_versions = relationship("BehaviorVersion", back_populates="creator")
    audit_logs = relationship("AuditLog", back_populates="actor")


class BehaviorUnit(Base):
    __tablename__ = "behavior_units"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    unit_type = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    organization = relationship("Organization", back_populates="behavior_units")
    versions = relationship("BehaviorVersion", back_populates="unit", cascade="all, delete-orphan")
    eval_sets = relationship("EvalSet", back_populates="unit", cascade="all, delete-orphan")
    drift_events = relationship("DriftEvent", back_populates="unit", cascade="all, delete-orphan")
    production_samples = relationship("ProductionSample", back_populates="unit", cascade="all, delete-orphan")
    github_integrations = relationship("GitHubIntegration", back_populates="unit")


class BehaviorVersion(Base):
    __tablename__ = "behavior_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    unit_id = Column(UUID(as_uuid=True), ForeignKey("behavior_units.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    content = Column(JSON, nullable=False)
    model_config = Column(JSON, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    git_commit = Column(String, nullable=True)
    git_branch = Column(String, nullable=True)
    source_provider = Column(String, nullable=False, default="manual")
    source_repo = Column(String, nullable=True)
    source_path = Column(String, nullable=True)
    source_ref = Column(String, nullable=True)
    source_sha = Column(String, nullable=True)
    status = Column(String, nullable=False, default="draft")
    behavioral_fingerprint = Column(JSON, nullable=True)
    fingerprint_meta = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    unit = relationship("BehaviorUnit", back_populates="versions")
    creator = relationship("User", back_populates="created_versions")
    eval_runs = relationship("EvalRun", back_populates="version", cascade="all, delete-orphan")
    drift_events = relationship("DriftEvent", back_populates="version")
    github_sync_events = relationship("GitHubSyncEvent", back_populates="version")


class EvalSet(Base):
    __tablename__ = "eval_sets"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("behavior_units.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    cases = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    organization = relationship("Organization", back_populates="eval_sets")
    unit = relationship("BehaviorUnit", back_populates="eval_sets")
    eval_runs = relationship("EvalRun", back_populates="eval_set", cascade="all, delete-orphan")


class EvalRun(Base):
    __tablename__ = "eval_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    version_id = Column(UUID(as_uuid=True), ForeignKey("behavior_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    eval_set_id = Column(UUID(as_uuid=True), ForeignKey("eval_sets.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, nullable=False, default="pending")
    results = Column(JSON, nullable=True)
    score = Column(Float, nullable=True)
    triggered_by = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    version = relationship("BehaviorVersion", back_populates="eval_runs")
    eval_set = relationship("EvalSet", back_populates="eval_runs")


class DriftEvent(Base):
    __tablename__ = "drift_events"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    unit_id = Column(UUID(as_uuid=True), ForeignKey("behavior_units.id", ondelete="CASCADE"), nullable=False, index=True)
    version_id = Column(UUID(as_uuid=True), ForeignKey("behavior_versions.id", ondelete="SET NULL"), nullable=True, index=True)
    severity = Column(String, nullable=False)
    drift_score = Column(Float, nullable=False)
    details = Column(JSON, nullable=False)
    root_cause = Column(JSON, nullable=True)
    resolved = Column(Boolean, nullable=False, default=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    unit = relationship("BehaviorUnit", back_populates="drift_events")
    version = relationship("BehaviorVersion", back_populates="drift_events")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String, nullable=False)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    resource_type = Column(String, nullable=False)
    resource_id = Column(String, nullable=False)
    metadata_ = Column("metadata", JSON, nullable=False)
    signed_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    organization = relationship("Organization", back_populates="audit_logs")
    actor = relationship("User", back_populates="audit_logs")


class AlertConfig(Base):
    __tablename__ = "alert_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_type = Column(String, nullable=False)
    channel = Column(String, nullable=False)
    config = Column(JSON, nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    organization = relationship("Organization", back_populates="alert_configs")


class ProductionSample(Base):
    __tablename__ = "production_samples"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    unit_id = Column(UUID(as_uuid=True), ForeignKey("behavior_units.id", ondelete="CASCADE"), nullable=False, index=True)
    input_text = Column(Text, nullable=False)
    output_text = Column(Text, nullable=False)
    embedding = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    unit = relationship("BehaviorUnit", back_populates="production_samples")


class GitHubIntegration(Base):
    __tablename__ = "github_integrations"
    __table_args__ = (
        UniqueConstraint("org_id", "repo_full_name", name="uq_github_integrations_org_repo"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("behavior_units.id", ondelete="SET NULL"), nullable=True, index=True)
    repo_full_name = Column(String, nullable=False, index=True)
    default_branch = Column(String, nullable=False, default="main")
    tracked_paths = Column(JSON, nullable=False, default=list)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    organization = relationship("Organization", back_populates="github_integrations")
    unit = relationship("BehaviorUnit", back_populates="github_integrations")
    sync_events = relationship("GitHubSyncEvent", back_populates="integration", cascade="all, delete-orphan")


class GitHubSyncEvent(Base):
    __tablename__ = "github_sync_events"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    integration_id = Column(UUID(as_uuid=True), ForeignKey("github_integrations.id", ondelete="CASCADE"), nullable=False, index=True)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("behavior_units.id", ondelete="SET NULL"), nullable=True, index=True)
    version_id = Column(UUID(as_uuid=True), ForeignKey("behavior_versions.id", ondelete="SET NULL"), nullable=True, index=True)
    event_type = Column(String, nullable=False)
    branch = Column(String, nullable=True)
    commit_sha = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    status = Column(String, nullable=False, default="received")
    details = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    organization = relationship("Organization", back_populates="github_sync_events")
    integration = relationship("GitHubIntegration", back_populates="sync_events")
    unit = relationship("BehaviorUnit")
    version = relationship("BehaviorVersion", back_populates="github_sync_events")
