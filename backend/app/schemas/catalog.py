from pydantic import BaseModel


class TopicCatalogResponse(BaseModel):
    id: str
    label: str
    question_count: int
    description: str


class PublishedCatalogResponse(BaseModel):
    topics: list[TopicCatalogResponse]
    knowledge_version: str | None
