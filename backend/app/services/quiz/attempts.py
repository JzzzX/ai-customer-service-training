import random
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    KnowledgeProgress,
    KnowledgeVersion,
    Question,
    QuizAnswer,
    QuizAttempt,
    QuizSet,
    quiz_set_questions,
)
from app.repositories.quiz_attempts import QuizAttemptRepository


class QuizAttemptError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class SafeQuestion:
    id: str
    prompt: str
    options: list[str]
    question_type: str
    category: str
    difficulty: str
    position: int


@dataclass(frozen=True)
class AttemptSession:
    attempt_id: str
    topic_id: str
    topic_label: str
    passing_score: int
    questions: list[SafeQuestion]


@dataclass(frozen=True)
class AnswerFeedback:
    question_id: str
    selected_answers: list[str]
    is_correct: bool
    correct_answers: list[str]
    explanation: str


@dataclass(frozen=True)
class AttemptResult:
    attempt_id: str
    topic_id: str
    topic_label: str
    score: int
    status: str
    correct_count: int
    total_questions: int
    answers: list[AnswerFeedback]
    completed_at: datetime


@dataclass(frozen=True)
class TopicProgress:
    topic_id: str
    label: str
    total_questions: int
    unique_answered_count: int
    total_correct_answers: int
    total_answered_answers: int
    accuracy: int
    attempt_count: int


@dataclass(frozen=True)
class RecentAttempt:
    attempt_id: str
    topic_id: str
    topic_label: str
    score: int
    status: str
    completed_at: datetime


@dataclass(frozen=True)
class QuizProgress:
    total_questions: int
    unique_answered_count: int
    total_correct_answers: int
    total_answered_answers: int
    accuracy: int
    attempt_count: int
    topics: list[TopicProgress]
    recent_attempts: list[RecentAttempt]


class QuizAttemptService:
    def __init__(self, session: Session, *, rng: Any | None = None) -> None:
        self.session = session
        self.repository = QuizAttemptRepository(session)
        self.rng = rng or random.SystemRandom()

    def start_attempt(self, learner_id: str, topic_id: str) -> AttemptSession:
        quiz_set = self.repository.find_published_topic(topic_id)
        if not quiz_set:
            raise QuizAttemptError("QUIZ_NOT_FOUND", "当前专题不存在或尚未发布。", 404)
        questions = self.repository.list_published_questions(quiz_set.id)
        selected = _select_by_difficulty(questions, 10, self.rng)
        if not selected:
            raise QuizAttemptError("QUIZ_NOT_FOUND", "当前专题暂无已发布题目。", 404)
        attempt = QuizAttempt(
            id=str(uuid4()),
            learner_id=learner_id,
            quiz_set=quiz_set,
            knowledge_version_id=quiz_set.knowledge_version_id,
            question_ids=[question.id for question in selected],
            status="in_progress",
            total_questions=len(selected),
        )
        self.session.add(attempt)
        self.session.flush()
        return AttemptSession(
            attempt_id=attempt.id,
            topic_id=quiz_set.topic_key or quiz_set.id,
            topic_label=quiz_set.label,
            passing_score=quiz_set.passing_score,
            questions=[_safe_question(question) for question in selected],
        )

    def submit_attempt(
        self,
        learner_id: str,
        attempt_id: str,
        answers: list[dict[str, object]],
    ) -> AttemptResult:
        attempt = self.repository.get_attempt(attempt_id)
        if not attempt:
            raise QuizAttemptError("QUIZ_ATTEMPT_INVALID", "答题记录不存在。", 404)
        if attempt.learner_id != learner_id:
            raise QuizAttemptError("QUIZ_ATTEMPT_FORBIDDEN", "无权访问该答题记录。", 403)
        if attempt.status != "in_progress":
            return self._load_result(attempt)

        expected_ids = list(attempt.question_ids)
        submitted_ids = [str(item.get("question_id", "")) for item in answers]
        if len(submitted_ids) != len(expected_ids) or set(submitted_ids) != set(expected_ids):
            raise QuizAttemptError("QUIZ_ATTEMPT_INVALID", "必须提交本次抽取的全部题目。")
        questions = {
            question.id: question
            for question in self.session.scalars(
                select(Question).where(Question.id.in_(expected_ids))
            )
        }
        if set(questions) != set(expected_ids):
            raise QuizAttemptError("QUIZ_ATTEMPT_INVALID", "题目已不属于当前正式题组。")

        checked: list[tuple[Question, list[str], bool]] = []
        for item in answers:
            question_id = str(item.get("question_id", ""))
            selected_value = item.get("selected_answers")
            if not isinstance(selected_value, list) or not selected_value:
                raise QuizAttemptError("QUIZ_ATTEMPT_INVALID", "每道题都必须选择答案。")
            selected = [str(value) for value in selected_value]
            question = questions[question_id]
            if any(value not in question.options for value in selected):
                raise QuizAttemptError("QUIZ_ATTEMPT_INVALID", "答案选项不属于题目。")
            checked.append((question, selected, _evaluate(selected, question.correct_answers)))

        completed_at = datetime.now(UTC)
        for question, selected, is_correct in checked:
            self.session.add(
                QuizAnswer(
                    id=_answer_id(attempt.id, question.id),
                    quiz_attempt_id=attempt.id,
                    question_id=question.id,
                    selected_answers=selected,
                    is_correct=is_correct,
                    answered_at=completed_at,
                )
            )
        correct_count = sum(is_correct for _, _, is_correct in checked)
        score = round(correct_count / len(checked) * 100)
        attempt.correct_count = correct_count
        attempt.score = score
        attempt.status = "passed" if score >= attempt.quiz_set.passing_score else "needs_retry"
        attempt.completed_at = completed_at
        self.session.flush()
        self._refresh_progress(learner_id)
        return self._load_result(attempt)

    def get_progress(self, learner_id: str) -> QuizProgress:
        return self._build_progress(learner_id)

    def _load_result(self, attempt: QuizAttempt) -> AttemptResult:
        answers = list(
            self.session.scalars(
                select(QuizAnswer)
                .where(QuizAnswer.quiz_attempt_id == attempt.id)
                .order_by(QuizAnswer.answered_at, QuizAnswer.id)
            )
        )
        questions = {
            question.id: question
            for question in self.session.scalars(
                select(Question).where(Question.id.in_(attempt.question_ids))
            )
        }
        answers_by_question = {answer.question_id: answer for answer in answers}
        feedback = [
            AnswerFeedback(
                question_id=answers_by_question[question_id].question_id,
                selected_answers=answers_by_question[question_id].selected_answers,
                is_correct=answers_by_question[question_id].is_correct,
                correct_answers=questions[question_id].correct_answers,
                explanation=questions[question_id].explanation,
            )
            for question_id in attempt.question_ids
            if question_id in answers_by_question and question_id in questions
        ]
        return AttemptResult(
            attempt_id=attempt.id,
            topic_id=attempt.quiz_set.topic_key or attempt.quiz_set.id,
            topic_label=attempt.quiz_set.label,
            score=attempt.score or 0,
            status=attempt.status,
            correct_count=attempt.correct_count,
            total_questions=attempt.total_questions,
            answers=feedback,
            completed_at=_as_utc(attempt.completed_at or datetime.now(UTC)),
        )

    def _refresh_progress(self, learner_id: str) -> None:
        progress = self._build_progress(learner_id)
        stored = self.session.get(KnowledgeProgress, learner_id)
        if not stored:
            stored = KnowledgeProgress(learner_id=learner_id)
            self.session.add(stored)
        stored.total_questions = progress.total_questions
        stored.unique_answered_count = progress.unique_answered_count
        stored.total_correct_answers = progress.total_correct_answers
        stored.total_answered_answers = progress.total_answered_answers
        stored.accuracy = progress.accuracy
        stored.attempt_count = progress.attempt_count
        self.session.flush()

    def _build_progress(self, learner_id: str) -> QuizProgress:
        active_sets = list(
            self.session.scalars(
                select(QuizSet)
                .join(KnowledgeVersion, QuizSet.knowledge_version_id == KnowledgeVersion.id)
                .where(
                    QuizSet.status == "published",
                    KnowledgeVersion.status == "published",
                    KnowledgeVersion.is_active.is_(True),
                )
            )
        )
        active_set_ids = [quiz_set.id for quiz_set in active_sets]
        questions = list(
            self.session.scalars(
                select(Question)
                .join(
                    quiz_set_questions,
                    quiz_set_questions.c.question_id == Question.id,
                )
                .where(
                    quiz_set_questions.c.quiz_set_id.in_(active_set_ids or [""]),
                    Question.status == "published",
                )
            )
        )
        attempts = list(
            self.session.scalars(
                select(QuizAttempt)
                .where(
                    QuizAttempt.learner_id == learner_id,
                    QuizAttempt.completed_at.is_not(None),
                )
                .order_by(QuizAttempt.completed_at.desc(), QuizAttempt.id.desc())
            )
        )
        attempt_ids = [attempt.id for attempt in attempts]
        answers = list(
            self.session.scalars(
                select(QuizAnswer).where(
                    QuizAnswer.quiz_attempt_id.in_(attempt_ids or [""])
                )
            )
        )
        set_by_id = {quiz_set.id: quiz_set for quiz_set in active_sets}
        questions_by_set: dict[str, list[Question]] = {quiz_set.id: [] for quiz_set in active_sets}
        question_rows = self.session.execute(
            select(quiz_set_questions.c.quiz_set_id, Question)
            .join(Question, Question.id == quiz_set_questions.c.question_id)
            .where(
                quiz_set_questions.c.quiz_set_id.in_(active_set_ids or [""]),
                Question.status == "published",
            )
        )
        for quiz_set_id, question in question_rows:
            questions_by_set.setdefault(quiz_set_id, []).append(question)
        answers_by_attempt: dict[str, list[QuizAnswer]] = {}
        for answer in answers:
            answers_by_attempt.setdefault(answer.quiz_attempt_id, []).append(answer)
        topics: list[TopicProgress] = []
        for quiz_set in active_sets:
            topic_attempts = [attempt for attempt in attempts if attempt.quiz_set_id == quiz_set.id]
            topic_answers = [
                answer
                for attempt in topic_attempts
                for answer in answers_by_attempt.get(attempt.id, [])
            ]
            topics.append(
                TopicProgress(
                    topic_id=quiz_set.topic_key or quiz_set.id,
                    label=quiz_set.label,
                    total_questions=len(questions_by_set.get(quiz_set.id, [])),
                    unique_answered_count=len({answer.question_id for answer in topic_answers}),
                    total_correct_answers=sum(answer.is_correct for answer in topic_answers),
                    total_answered_answers=len(topic_answers),
                    accuracy=_percentage(
                        sum(answer.is_correct for answer in topic_answers),
                        len(topic_answers),
                    ),
                    attempt_count=len(topic_attempts),
                )
            )
        total_correct = sum(answer.is_correct for answer in answers)
        return QuizProgress(
            total_questions=len(questions),
            unique_answered_count=len({answer.question_id for answer in answers}),
            total_correct_answers=total_correct,
            total_answered_answers=len(answers),
            accuracy=_percentage(total_correct, len(answers)),
            attempt_count=len(attempts),
            topics=topics,
            recent_attempts=[
                RecentAttempt(
                    attempt_id=attempt.id,
                    topic_id=attempt.quiz_set.topic_key or attempt.quiz_set.id,
                    topic_label=attempt.quiz_set.label,
                    score=attempt.score or 0,
                    status=attempt.status,
                    completed_at=attempt.completed_at,
                )
                for attempt in attempts[:20]
            ],
        )


def _safe_question(question: Question) -> SafeQuestion:
    return SafeQuestion(
        id=question.id,
        prompt=question.prompt,
        options=list(question.options),
        question_type=question.question_type,
        category=question.category,
        difficulty=question.difficulty,
        position=question.position,
    )


def _select_by_difficulty(
    questions: list[Question], limit: int, rng: Any
) -> list[Question]:
    quotas = {"easy": 4, "medium": 4, "hard": 2}
    buckets = {difficulty: [] for difficulty in quotas}
    for question in questions:
        buckets.setdefault(question.difficulty, []).append(question)
    selected: list[Question] = []
    leftovers: list[Question] = []
    for difficulty, quota in quotas.items():
        pool = list(buckets.get(difficulty, []))
        rng.shuffle(pool)
        selected.extend(pool[:quota])
        leftovers.extend(pool[quota:])
    if len(selected) < limit:
        rng.shuffle(leftovers)
        selected.extend(leftovers[: limit - len(selected)])
    rng.shuffle(selected)
    return selected[:limit]


def _evaluate(selected: list[str], correct: list[str]) -> bool:
    return sorted(selected) == sorted(correct)


def _percentage(correct: int, total: int) -> int:
    return round(correct / total * 100) if total else 0


def _answer_id(attempt_id: str, question_id: str) -> str:
    import hashlib

    return "answer_" + hashlib.sha256(f"{attempt_id}\0{question_id}".encode()).hexdigest()[:24]


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)
