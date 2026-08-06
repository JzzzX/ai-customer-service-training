from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Select, select
from sqlalchemy.orm import Session, selectinload

from app.models import Scenario, ScenarioVersion, TrainingMessage, TrainingSession


def _status_values(status: str) -> tuple[str, ...]:
    if status == "active":
        return ("in_progress",)
    if status == "completed":
        return ("completed", "needs_review")
    return ("in_progress", "completed", "needs_review")


def _cursor_offset(cursor: str | None) -> int:
    if not cursor:
        return 0
    try:
        return max(0, int(cursor))
    except ValueError:
        return 0


class ScenarioRepository:
    def __init__(self, database: Session) -> None:
        self.database = database

    def list_published(self) -> list[ScenarioVersion]:
        statement = (
            select(ScenarioVersion)
            .join(Scenario, Scenario.id == ScenarioVersion.scenario_id)
            .where(
                Scenario.status == "published",
                ScenarioVersion.status == "published",
            )
            .options(selectinload(ScenarioVersion.scenario))
            .order_by(Scenario.title.asc(), ScenarioVersion.version.desc(), Scenario.id.asc())
        )
        return list(self.database.scalars(statement).all())

    def get_published_version(self, scenario_id: str) -> ScenarioVersion | None:
        statement = (
            select(ScenarioVersion)
            .join(Scenario, Scenario.id == ScenarioVersion.scenario_id)
            .where(
                Scenario.id == scenario_id,
                Scenario.status == "published",
                ScenarioVersion.status == "published",
            )
            .options(selectinload(ScenarioVersion.scenario))
            .order_by(ScenarioVersion.version.desc())
        )
        return self.database.scalars(statement).first()

    def create_session(
        self,
        *,
        learner_id: str,
        version: ScenarioVersion,
        mode: str,
    ) -> TrainingSession:
        now = datetime.now(UTC)
        session = TrainingSession(
            id=f"training_{uuid4().hex}",
            learner_id=learner_id,
            scenario_version_id=version.id,
            knowledge_version_id=version.knowledge_version_id,
            status="in_progress",
            mode=mode,
            turn_count=0,
            max_turns=version.max_turns,
            started_at=now,
            updated_at=now,
        )
        session.messages.append(
            TrainingMessage(
                id=f"message_{uuid4().hex}",
                position=0,
                sender="customer",
                content=version.opening_message,
                metadata_json={"turn": 0},
            )
        )
        self.database.add(session)
        return session

    def get_owned_session(self, session_id: str, learner_id: str) -> TrainingSession | None:
        statement = (
            select(TrainingSession)
            .where(
                TrainingSession.id == session_id,
                TrainingSession.learner_id == learner_id,
            )
            .options(
                selectinload(TrainingSession.messages),
                selectinload(TrainingSession.scenario_version).selectinload(
                    ScenarioVersion.scenario
                ),
                selectinload(TrainingSession.report),
            )
        )
        return self.database.scalars(statement).first()

    def append_messages(
        self,
        session: TrainingSession,
        messages: list[tuple[str, str, dict[str, object]]],
        *,
        turn_count: int,
    ) -> TrainingSession:
        position = len(session.messages)
        for sender, content, metadata in messages:
            session.messages.append(
                TrainingMessage(
                    id=f"message_{uuid4().hex}",
                    position=position,
                    sender=sender,
                    content=content,
                    metadata_json=metadata,
                )
            )
            position += 1
        session.turn_count = turn_count
        session.updated_at = datetime.now(UTC)
        return session

    def list_history_groups(
        self,
        learner_id: str,
        *,
        status: str = "all",
        cursor: str | None = None,
        limit: int = 20,
    ) -> list[dict[str, object]]:
        sessions = list(self.database.scalars(self._history_query(learner_id, status)).all())
        groups: dict[str, dict[str, object]] = {}
        for session in sessions:
            version = session.scenario_version
            scenario = version.scenario
            activity = session.updated_at or session.started_at
            group = groups.setdefault(
                scenario.id,
                {
                    "scenario_id": scenario.id,
                    "scenario_key": scenario.scenario_key,
                    "title": scenario.title,
                    "category": scenario.category,
                    "total_session_count": 0,
                    "active_session_count": 0,
                    "completed_session_count": 0,
                    "latest_session": session,
                    "latest_activity_at": activity,
                },
            )
            group["total_session_count"] = int(group["total_session_count"]) + 1
            if session.status == "in_progress":
                group["active_session_count"] = int(group["active_session_count"]) + 1
            else:
                group["completed_session_count"] = int(group["completed_session_count"]) + 1
            if activity and activity > group["latest_activity_at"]:
                group["latest_activity_at"] = activity
                group["latest_session"] = session
        ordered = sorted(
            groups.values(),
            key=lambda item: (item["latest_activity_at"], item["scenario_id"]),
            reverse=True,
        )
        offset = _cursor_offset(cursor)
        return ordered[offset : offset + max(1, min(limit, 100))]

    def list_history_sessions(
        self,
        learner_id: str,
        scenario_id: str,
        *,
        status: str = "all",
        cursor: str | None = None,
        limit: int = 10,
    ) -> tuple[list[TrainingSession], str | None]:
        statement = self._history_query(learner_id, status).where(
            Scenario.id == scenario_id
        )
        sessions = list(self.database.scalars(statement).all())
        offset = _cursor_offset(cursor)
        page_size = max(1, min(limit, 100))
        page = sessions[offset : offset + page_size]
        next_cursor = str(offset + page_size) if offset + page_size < len(sessions) else None
        return page, next_cursor

    def _history_query(self, learner_id: str, status: str) -> Select[tuple[TrainingSession]]:
        return (
            select(TrainingSession)
            .join(ScenarioVersion, ScenarioVersion.id == TrainingSession.scenario_version_id)
            .join(Scenario, Scenario.id == ScenarioVersion.scenario_id)
            .where(
                TrainingSession.learner_id == learner_id,
                TrainingSession.status.in_(_status_values(status)),
            )
            .options(
                selectinload(TrainingSession.messages),
                selectinload(TrainingSession.scenario_version).selectinload(
                    ScenarioVersion.scenario
                ),
                selectinload(TrainingSession.report),
            )
            .order_by(TrainingSession.updated_at.desc(), TrainingSession.id.desc())
        )
