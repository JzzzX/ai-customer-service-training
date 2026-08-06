import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import KnowledgeUnit, KnowledgeVersion, Question, QuizSet


class QuestionPublicationInput(BaseModel):
    id: str
    knowledge_unit_key: str
    question_type: Literal["single_choice", "true_false"]
    prompt: str
    options: list[str] = Field(min_length=2)
    correct_answers: list[str] = Field(min_length=1, max_length=1)
    explanation: str
    category: str
    difficulty: Literal["easy", "medium", "hard"]
    position: int = Field(ge=1)

    @model_validator(mode="after")
    def answer_must_belong_to_options(self):
        if any(answer not in self.options for answer in self.correct_answers):
            raise ValueError("correct answer must belong to the question options")
        return self


class TopicPublicationInput(BaseModel):
    id: str
    label: str
    description: str
    passing_score: int = Field(ge=0, le=100)
    quiz_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    questions: list[QuestionPublicationInput] = Field(min_length=1)


class QuizPublicationInput(BaseModel):
    schema_version: Literal[1] = 1
    knowledge_version_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    topics: list[TopicPublicationInput] = Field(min_length=1)
    export_hash: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")


@dataclass(frozen=True)
class QuizPublicationResult:
    knowledge_version_id: str
    topic_count: int
    question_count: int
    created_topic_count: int


class QuizPublicationService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def publish(self, payload: QuizPublicationInput) -> QuizPublicationResult:
        version = self.session.scalar(
            select(KnowledgeVersion).where(
                KnowledgeVersion.version_hash == payload.knowledge_version_hash,
                KnowledgeVersion.status == "published",
                KnowledgeVersion.is_active.is_(True),
            )
        )
        if not version:
            raise ValueError("active published knowledge version was not found")

        unit_keys = {
            question.knowledge_unit_key
            for topic in payload.topics
            for question in topic.questions
        }
        units = self.session.scalars(
            select(KnowledgeUnit).where(
                KnowledgeUnit.knowledge_version_id == version.id,
                KnowledgeUnit.unit_key.in_(unit_keys),
            )
        ).all()
        units_by_key = {unit.unit_key: unit for unit in units}
        created_count = 0
        total_questions = 0

        for topic in payload.topics:
            total_questions += len(topic.questions)
            existing = self.session.scalar(
                select(QuizSet).where(QuizSet.quiz_hash == topic.quiz_hash)
            )
            if existing:
                continue
            self.session.execute(
                update(QuizSet)
                .where(
                    QuizSet.knowledge_version_id == version.id,
                    QuizSet.topic_key == topic.id,
                    QuizSet.status == "published",
                )
                .values(status="archived")
            )
            prepared_questions: list[
                tuple[QuestionPublicationInput, KnowledgeUnit]
            ] = []
            seen_question_keys: set[str] = set()
            for question in topic.questions:
                if question.id in seen_question_keys:
                    raise ValueError(f"duplicate question key: {question.id}")
                seen_question_keys.add(question.id)
                unit = units_by_key.get(question.knowledge_unit_key)
                if not unit:
                    raise ValueError(
                        f"missing knowledge unit: {question.knowledge_unit_key}"
                    )
                if unit.has_conflict or not unit.can_use_for_quiz:
                    raise ValueError(
                        f"conflicting knowledge cannot be published: {question.knowledge_unit_key}"
                    )
                prepared_questions.append((question, unit))
            quiz_set = QuizSet(
                id=_stable_id("qs", version.id, topic.id, topic.quiz_hash),
                knowledge_version=version,
                topic_key=topic.id,
                quiz_hash=topic.quiz_hash,
                label=topic.label,
                description=topic.description,
                passing_score=topic.passing_score,
                status="published",
                published_at=datetime.now(UTC),
            )
            for question, unit in prepared_questions:
                quiz_set.questions.append(
                    Question(
                        id=_stable_id("qdb", version.id, topic.id, question.id),
                        question_key=question.id,
                        knowledge_unit=unit,
                        prompt=question.prompt,
                        question_type=question.question_type,
                        options=question.options,
                        correct_answers=question.correct_answers,
                        explanation=question.explanation,
                        category=question.category,
                        difficulty=question.difficulty,
                        position=question.position,
                        status="published",
                    )
                )
            self.session.add(quiz_set)
            created_count += 1

        self.session.flush()
        return QuizPublicationResult(
            knowledge_version_id=version.id,
            topic_count=len(payload.topics),
            question_count=total_questions,
            created_topic_count=created_count,
        )


def canonical_quiz_hash(value: object) -> str:
    content = json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(content).hexdigest()


def _stable_id(prefix: str, *parts: str) -> str:
    return f"{prefix}_{canonical_quiz_hash(parts)[:24]}"
