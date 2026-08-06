import json
from dataclasses import dataclass
from typing import Any

from pydantic import ValidationError
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.models import KnowledgeSource, KnowledgeUnit, KnowledgeVersion, Question, QuizSet
from app.services.quiz.publication import (
    QuizPublicationInput,
    QuizPublicationResult,
    QuizPublicationService,
    canonical_quiz_hash,
)


@dataclass(frozen=True)
class Phase3MigrationResult:
    knowledge_version_id: str
    topic_count: int
    question_count: int
    created_topic_count: int


@dataclass(frozen=True)
class Phase3ReconciliationReport:
    passed: bool
    source_topic_count: int
    imported_topic_count: int
    source_question_count: int
    imported_question_count: int
    source_hash: str
    target_hash: str
    errors: list[str]


def migrate_phase3_export(
    session: Session, payload: dict[str, Any]
) -> Phase3MigrationResult:
    publication = _validate_export(payload)
    raw_topics = payload["topics"]
    version = _ensure_knowledge_version(session, publication)
    _ensure_sources_and_units(session, version, raw_topics)
    result: QuizPublicationResult = QuizPublicationService(session).publish(publication)
    return Phase3MigrationResult(
        knowledge_version_id=result.knowledge_version_id,
        topic_count=result.topic_count,
        question_count=result.question_count,
        created_topic_count=result.created_topic_count,
    )


def reconcile_phase3_export(
    session: Session, payload: dict[str, Any]
) -> Phase3ReconciliationReport:
    publication = _validate_export(payload)
    source_projection = _source_projection(payload)
    source_hash = canonical_quiz_hash(source_projection)
    source_topics = payload["topics"]
    source_question_count = sum(len(topic["questions"]) for topic in source_topics)
    version = session.scalar(
        select(KnowledgeVersion).where(
            KnowledgeVersion.version_hash == publication.knowledge_version_hash,
            KnowledgeVersion.status == "published",
            KnowledgeVersion.is_active.is_(True),
        )
    )
    errors: list[str] = []
    if not version:
        return Phase3ReconciliationReport(
            passed=False,
            source_topic_count=len(source_topics),
            imported_topic_count=0,
            source_question_count=source_question_count,
            imported_question_count=0,
            source_hash=source_hash,
            target_hash="",
            errors=["active published knowledge version is missing"],
        )

    target_projection = _target_projection(session, version)
    target_hash = canonical_quiz_hash(target_projection)
    imported_topics = target_projection["topics"]
    imported_question_count = sum(
        len(topic["questions"]) for topic in imported_topics
    )
    if len(imported_topics) != len(source_topics):
        errors.append("topic count mismatch")
    if imported_question_count != source_question_count:
        errors.append("question count mismatch")
    if source_hash != target_hash:
        errors.append("question payload hash mismatch")
    return Phase3ReconciliationReport(
        passed=not errors,
        source_topic_count=len(source_topics),
        imported_topic_count=len(imported_topics),
        source_question_count=source_question_count,
        imported_question_count=imported_question_count,
        source_hash=source_hash,
        target_hash=target_hash,
        errors=errors,
    )


def _validate_export(payload: dict[str, Any]) -> QuizPublicationInput:
    try:
        publication = QuizPublicationInput.model_validate(payload)
    except ValidationError as error:
        raise ValueError("invalid phase 3 export: " + str(error)) from error
    topics = payload.get("topics")
    if not isinstance(topics, list):
        raise ValueError("invalid phase 3 export: topics must be a list")
    for topic in topics:
        if not isinstance(topic, dict):
            raise ValueError("invalid phase 3 export: topic must be an object")
        questions = topic.get("questions")
        if not isinstance(questions, list):
            raise ValueError("invalid phase 3 export: questions must be a list")
        for question in questions:
            if not isinstance(question, dict):
                raise ValueError("invalid phase 3 export: question must be an object")
            sources = question.get("sources")
            if not isinstance(sources, list) or not sources:
                raise ValueError(
                    f"question sources are required: {question.get('id', '<unknown>')}"
                )
            for source in sources:
                if not isinstance(source, dict) or not source.get("source_path"):
                    raise ValueError("question sources must include source_path")
    return publication


def _ensure_knowledge_version(
    session: Session, payload: QuizPublicationInput
) -> KnowledgeVersion:
    version = session.scalar(
        select(KnowledgeVersion).where(
            KnowledgeVersion.version_hash == payload.knowledge_version_hash
        )
    )
    session.execute(
        update(KnowledgeVersion)
        .where(KnowledgeVersion.is_active.is_(True))
        .values(is_active=False)
    )
    if not version:
        version = KnowledgeVersion(
            id=f"kv_{payload.knowledge_version_hash[:24]}",
            version_hash=payload.knowledge_version_hash,
            label="Phase 3 历史题库导入",
            schema_version=payload.schema_version,
            source_root="legacy://phase3-export",
            status="published",
            is_active=True,
            coverage={
                "topic_count": len(payload.topics),
                "question_count": sum(len(topic.questions) for topic in payload.topics),
            },
        )
        session.add(version)
    else:
        version.status = "published"
        version.is_active = True
        version.schema_version = payload.schema_version
        version.coverage = {
            "topic_count": len(payload.topics),
            "question_count": sum(len(topic.questions) for topic in payload.topics),
        }
    session.flush()
    return version


def _ensure_sources_and_units(
    session: Session, version: KnowledgeVersion, raw_topics: list[dict[str, Any]]
) -> None:
    questions_by_unit: dict[str, list[dict[str, Any]]] = {}
    source_records: dict[str, list[dict[str, Any]]] = {}
    for topic in raw_topics:
        for question in topic["questions"]:
            unit_key = question["knowledge_unit_key"]
            questions_by_unit.setdefault(unit_key, []).append(question)
            for source in question["sources"]:
                normalized = _normalize_source(source)
                source_records.setdefault(normalized["source_path"], []).append(normalized)

    for source_path, records in source_records.items():
        source_hash = canonical_quiz_hash(records)
        stored = session.scalar(
            select(KnowledgeSource).where(
                KnowledgeSource.knowledge_version_id == version.id,
                KnowledgeSource.source_path == source_path,
            )
        )
        if not stored:
            stored = KnowledgeSource(
                id=f"src_{canonical_quiz_hash((version.id, source_path))[:24]}",
                knowledge_version_id=version.id,
                source_path=source_path,
                kind=records[0]["kind"],
                source_hash=source_hash,
                bytes=0,
                stats={"question_count": len(records)},
            )
            session.add(stored)
        else:
            stored.source_hash = source_hash
            stored.kind = records[0]["kind"]
            stored.stats = {"question_count": len(records)}

    for unit_key, questions in questions_by_unit.items():
        contents = [_unit_content(question) for question in questions]
        has_conflict = len(set(contents)) > 1
        first = questions[0]
        sources = _unique_sources(
            source
            for question in questions
            for source in question["sources"]
        )
        content = contents[0]
        content_hash = canonical_quiz_hash(content)
        stored = session.scalar(
            select(KnowledgeUnit).where(
                KnowledgeUnit.knowledge_version_id == version.id,
                KnowledgeUnit.unit_key == unit_key,
            )
        )
        if not stored:
            stored = KnowledgeUnit(
                id=f"ku_{canonical_quiz_hash((version.id, unit_key))[:24]}",
                knowledge_version_id=version.id,
                unit_key=unit_key,
                title=first["prompt"][:512],
                content=content,
                category_path=list(sources[0].get("path", [])) if sources else [],
                content_hash=content_hash,
                sources=sources,
                has_conflict=has_conflict,
                can_use_for_quiz=not has_conflict,
                can_use_for_scenario=not has_conflict,
                can_use_for_evaluation=not has_conflict,
            )
            session.add(stored)
        else:
            if stored.content_hash != content_hash:
                stored.has_conflict = True
                stored.can_use_for_quiz = False
                stored.can_use_for_scenario = False
                stored.can_use_for_evaluation = False
            stored.sources = sources
        session.flush()


def _normalize_source(source: dict[str, Any]) -> dict[str, Any]:
    return {
        "source_path": str(source["source_path"]),
        "kind": str(source.get("kind", "legacy")),
        "anchor": str(source.get("anchor", "")),
        "path": list(source.get("path", [])),
    }


def _unique_sources(sources: Any) -> list[dict[str, Any]]:
    unique: dict[str, dict[str, Any]] = {}
    for source in sources:
        normalized = _normalize_source(source)
        unique[json.dumps(normalized, ensure_ascii=False, sort_keys=True)] = normalized
    return [unique[key] for key in sorted(unique)]


def _unit_content(question: dict[str, Any]) -> str:
    return json.dumps(
        {
            "prompt": question["prompt"],
            "explanation": question["explanation"],
            "options": question["options"],
            "correct_answers": question["correct_answers"],
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def _source_projection(payload: dict[str, Any]) -> dict[str, Any]:
    topics = []
    for topic in sorted(payload["topics"], key=lambda item: item["id"]):
        questions = []
        for question in sorted(topic["questions"], key=lambda item: item["id"]):
            questions.append(
                {
                    "id": question["id"],
                    "knowledge_unit_key": question["knowledge_unit_key"],
                    "question_type": question["question_type"],
                    "prompt": question["prompt"],
                    "options": question["options"],
                    "correct_answers": question["correct_answers"],
                    "explanation": question["explanation"],
                    "category": question["category"],
                    "difficulty": question["difficulty"],
                    "position": question["position"],
                    "sources": _unique_sources(question["sources"]),
                }
            )
        topics.append(
            {
                "id": topic["id"],
                "label": topic["label"],
                "description": topic["description"],
                "passing_score": topic["passing_score"],
                "quiz_hash": topic["quiz_hash"],
                "questions": questions,
            }
        )
    return {
        "schema_version": payload["schema_version"],
        "knowledge_version_hash": payload["knowledge_version_hash"],
        "topics": topics,
    }


def _target_projection(
    session: Session, version: KnowledgeVersion
) -> dict[str, Any]:
    sets = list(
        session.scalars(
            select(QuizSet)
            .options(selectinload(QuizSet.questions).selectinload(Question.knowledge_unit))
            .where(
                QuizSet.knowledge_version_id == version.id,
                QuizSet.status == "published",
            )
        )
    )
    topics = []
    for quiz_set in sorted(sets, key=lambda item: item.topic_key or item.id):
        questions = []
        for question in sorted(
            [item for item in quiz_set.questions if item.status == "published"],
            key=lambda item: item.question_key or item.id,
        ):
            unit = question.knowledge_unit
            questions.append(
                {
                    "id": question.question_key or question.id,
                    "knowledge_unit_key": unit.unit_key if unit else "",
                    "question_type": question.question_type,
                    "prompt": question.prompt,
                    "options": question.options,
                    "correct_answers": question.correct_answers,
                    "explanation": question.explanation,
                    "category": question.category,
                    "difficulty": question.difficulty,
                    "position": question.position,
                    "sources": _unique_sources(unit.sources if unit else []),
                }
            )
        topics.append(
            {
                "id": quiz_set.topic_key or quiz_set.id,
                "label": quiz_set.label,
                "description": quiz_set.description,
                "passing_score": quiz_set.passing_score,
                "quiz_hash": quiz_set.quiz_hash,
                "questions": questions,
            }
        )
    return {
        "schema_version": version.schema_version,
        "knowledge_version_hash": version.version_hash,
        "topics": topics,
    }
