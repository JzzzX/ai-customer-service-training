from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Assignment, KnowledgeProgress, ScenarioProgressSummary


@dataclass(frozen=True)
class KnowledgeProgressValue:
    total_questions: int = 0
    unique_answered_count: int = 0
    total_correct_answers: int = 0
    total_answered_answers: int = 0
    accuracy: int = 0
    attempt_count: int = 0


@dataclass(frozen=True)
class ScenarioProgressValue:
    published_scenario_count: int = 0
    completed_scenario_count: int = 0
    completed_session_count: int = 0
    recent_average_score: int = 0


@dataclass(frozen=True)
class LearnerOverview:
    assignments: list[Assignment]
    knowledge: KnowledgeProgressValue
    scenario: ScenarioProgressValue


class LearnerOverviewRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_overview(self, learner_id: str) -> LearnerOverview:
        assignments = list(
            self.session.scalars(
                select(Assignment)
                .where(Assignment.learner_id == learner_id)
                .order_by(Assignment.created_at.desc(), Assignment.id.desc())
            )
        )
        knowledge = self.session.get(KnowledgeProgress, learner_id)
        scenario = self.session.get(ScenarioProgressSummary, learner_id)
        return LearnerOverview(
            assignments=assignments,
            knowledge=KnowledgeProgressValue(
                total_questions=knowledge.total_questions,
                unique_answered_count=knowledge.unique_answered_count,
                total_correct_answers=knowledge.total_correct_answers,
                total_answered_answers=knowledge.total_answered_answers,
                accuracy=knowledge.accuracy,
                attempt_count=knowledge.attempt_count,
            )
            if knowledge
            else KnowledgeProgressValue(),
            scenario=ScenarioProgressValue(
                published_scenario_count=scenario.published_scenario_count,
                completed_scenario_count=scenario.completed_scenario_count,
                completed_session_count=scenario.completed_session_count,
                recent_average_score=scenario.recent_average_score,
            )
            if scenario
            else ScenarioProgressValue(),
        )
