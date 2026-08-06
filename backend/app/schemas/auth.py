from typing import Literal

from pydantic import BaseModel


class CurrentUserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: Literal["admin", "learner"]
