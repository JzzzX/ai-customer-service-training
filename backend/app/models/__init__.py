from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from app.models.user import FeishuIdentity, User

__all__ = ["Base", "FeishuIdentity", "User"]
