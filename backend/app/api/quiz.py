from dataclasses import asdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_session
from app.core.errors import AppError
from app.models import User
from app.schemas.quiz import (
    AnswerFeedbackResponse,
    QuizAttemptResultResponse,
    QuizAttemptStartResponse,
    QuizProgressResponse,
    QuizRecentAttemptResponse,
    QuizTopicProgressResponse,
    QuizAttemptSubmitRequest,
    SafeQuestionResponse,
)
from app.services.quiz.attempts import QuizAttemptError, QuizAttemptService

router = APIRouter(tags=["quiz practice"])


@router.post(
    "/quiz/topics/{topic_id}/attempts",
    response_model=QuizAttemptStartResponse,
)
def start_quiz_attempt(
    topic_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> QuizAttemptStartResponse:
    try:
        attempt = QuizAttemptService(session).start_attempt(user.id, topic_id)
    except QuizAttemptError as error:
        raise _as_app_error(error) from error
    return QuizAttemptStartResponse(
        attempt_id=attempt.attempt_id,
        topic_id=attempt.topic_id,
        topic_label=attempt.topic_label,
        passing_score=attempt.passing_score,
        questions=[SafeQuestionResponse(**asdict(question)) for question in attempt.questions],
    )


@router.post(
    "/quiz/attempts/{attempt_id}/submit",
    response_model=QuizAttemptResultResponse,
)
def submit_quiz_attempt(
    attempt_id: str,
    payload: QuizAttemptSubmitRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> QuizAttemptResultResponse:
    try:
        result = QuizAttemptService(session).submit_attempt(
            user.id,
            attempt_id,
            [answer.model_dump() for answer in payload.answers],
        )
    except QuizAttemptError as error:
        raise _as_app_error(error) from error
    return QuizAttemptResultResponse(
        attempt_id=result.attempt_id,
        topic_id=result.topic_id,
        topic_label=result.topic_label,
        score=result.score,
        status=result.status,
        correct_count=result.correct_count,
        total_questions=result.total_questions,
        answers=[
            AnswerFeedbackResponse(**asdict(answer)) for answer in result.answers
        ],
        completed_at=result.completed_at,
    )


@router.get("/me/quiz-progress", response_model=QuizProgressResponse)
def get_quiz_progress(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> QuizProgressResponse:
    progress = QuizAttemptService(session).get_progress(user.id)
    return QuizProgressResponse(
        total_questions=progress.total_questions,
        unique_answered_count=progress.unique_answered_count,
        total_correct_answers=progress.total_correct_answers,
        total_answered_answers=progress.total_answered_answers,
        accuracy=progress.accuracy,
        attempt_count=progress.attempt_count,
        topics=[
            QuizTopicProgressResponse(**asdict(topic)) for topic in progress.topics
        ],
        recent_attempts=[
            QuizRecentAttemptResponse(**asdict(attempt))
            for attempt in progress.recent_attempts
        ],
    )


def _as_app_error(error: QuizAttemptError) -> AppError:
    return AppError(
        code=error.code,
        message=error.message,
        status_code=error.status_code,
    )
