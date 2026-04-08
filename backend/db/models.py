"""
SQLModel database models for VariantTools.
"""

import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, create_engine, Session, select

DATABASE_URL = "sqlite:///data/varianttools.db"

engine = create_engine(DATABASE_URL, echo=False)


class Job(SQLModel, table=True):
    id: str = Field(primary_key=True)
    module: str  # 'stats' | 'merge' | 'fixref' | 'liftover'
    status: str  # 'pending' | 'running' | 'completed' | 'failed'
    input_files: str  # JSON-encoded list of filenames
    output_file: Optional[str] = Field(default=None)
    error_message: Optional[str] = Field(default=None)
    celery_task_id: Optional[str] = Field(default=None)
    result_json: Optional[str] = Field(default=None)  # JSON-encoded result payload
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = Field(default=None)


class ChainFile(SQLModel, table=True):
    id: str = Field(primary_key=True)           # UUID
    name: str                                    # display name, e.g. "Wm82.a4→a6 FWD"
    source_assembly: str                         # e.g. "Wm82.a4"
    target_assembly: str                         # e.g. "Wm82.a6"
    tool_type: str                               # "crossmap" | "liftover"
    file_path: str                               # absolute path on server
    direction: str                               # "fwd" | "rev" | "both"
    notes: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)


def create_db_and_tables() -> None:
    """Create database tables if they don't already exist."""
    SQLModel.metadata.create_all(engine)


def get_session() -> Session:
    """Return a new SQLModel Session (caller must close it)."""
    return Session(engine)


def seed_chain_files() -> None:
    """Insert placeholder ChainFile records if none exist yet.

    These point to paths where users are expected to place their chain files.
    If the file doesn't exist on disk, the record is created but liftover will
    fail gracefully.
    """
    with get_session() as session:
        existing = session.exec(select(ChainFile)).all()
        if len(existing) > 0:
            return
        placeholders = [
            ChainFile(
                id=str(uuid.uuid4()),
                name="Wm82.a4\u2192a6 FWD (CrossMap)",
                source_assembly="Wm82.a4",
                target_assembly="Wm82.a6",
                tool_type="crossmap",
                file_path="data/chains/Wm82_a4_to_a6_FWD.chain",
                direction="fwd",
            ),
            ChainFile(
                id=str(uuid.uuid4()),
                name="Wm82.a4\u2192a6 REV (CrossMap)",
                source_assembly="Wm82.a4",
                target_assembly="Wm82.a6",
                tool_type="crossmap",
                file_path="data/chains/Wm82_a4_to_a6_REV.chain",
                direction="rev",
            ),
            ChainFile(
                id=str(uuid.uuid4()),
                name="Wm82.a1\u2192a6 FWD (CrossMap)",
                source_assembly="Wm82.a1",
                target_assembly="Wm82.a6",
                tool_type="crossmap",
                file_path="data/chains/Wm82_a1_to_a6_FWD.chain",
                direction="fwd",
            ),
            ChainFile(
                id=str(uuid.uuid4()),
                name="Wm82.a1\u2192a6 REV (CrossMap)",
                source_assembly="Wm82.a1",
                target_assembly="Wm82.a6",
                tool_type="crossmap",
                file_path="data/chains/Wm82_a1_to_a6_REV.chain",
                direction="rev",
            ),
        ]
        for cf in placeholders:
            session.add(cf)
        session.commit()
