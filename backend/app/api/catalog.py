from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_session
from app.repositories.catalog import PublishedCatalogRepository
from app.schemas.catalog import PublishedCatalogResponse, TopicCatalogResponse

router = APIRouter(prefix="/quiz", tags=["quiz catalog"])


@router.get("/topics", response_model=PublishedCatalogResponse)
def get_quiz_topics(
    session: Session = Depends(get_session),
) -> PublishedCatalogResponse:
    topics = PublishedCatalogRepository(session).list_topics()
    return PublishedCatalogResponse(
        topics=[
            TopicCatalogResponse(
                id=topic.id,
                label=topic.label,
                question_count=topic.question_count,
                description=topic.description,
            )
            for topic in topics
        ],
        knowledge_version=topics[0].knowledge_version if topics else None,
    )
