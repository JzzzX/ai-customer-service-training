from datetime import datetime

from pydantic import BaseModel


class SafeQuestionResponse(BaseModel):
    id: str
    prompt: str
    options: list[str]
    question_type: str
    category: str
    difficulty: str
    position: int


class QuizAttemptStartResponse(BaseModel):
    attempt_id: str
    topic_id: str
    topic_label: str
    passing_score: int
    questions: list[SafeQuestionResponse]


class SubmittedAnswerRequest(BaseModel):
    question_id: str
    selected_answers: list[str]


class QuizAttemptSubmitRequest(BaseModel):
    answers: list[SubmittedAnswerRequest]


class AnswerFeedbackResponse(BaseModel):
    question_id: str
    selected_answers: list[str]
    is_correct: bool
    correct_answers: list[str]
    explanation: str


class QuizAttemptResultResponse(BaseModel):
    attempt_id: str
    topic_id: str
    topic_label: str
    score: int
    status: str
    correct_count: int
    total_questions: int
    answers: list[AnswerFeedbackResponse]
    completed_at: datetime


class QuizTopicProgressResponse(BaseModel):
    topic_id: str
    label: str
    total_questions: int
    unique_answered_count: int
    total_correct_answers: int
    total_answered_answers: int
    accuracy: int
    attempt_count: int


class QuizRecentAttemptResponse(BaseModel):
    attempt_id: str
    topic_id: str
    topic_label: str
    score: int
    status: str
    completed_at: datetime


class QuizProgressResponse(BaseModel):
    total_questions: int
    unique_answered_count: int
    total_correct_answers: int
    total_answered_answers: int
    accuracy: int
    attempt_count: int
    topics: list[QuizTopicProgressResponse]
    recent_attempts: list[QuizRecentAttemptResponse]
