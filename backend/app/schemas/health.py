from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    service: str
    status: Literal["ok"]
    version: str


class ReadinessResponse(BaseModel):
    service: str
    status: Literal["ready"]
    database: Literal["ok"]
