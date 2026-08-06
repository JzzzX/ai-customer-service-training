from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import FeishuIdentity, User


class UserRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get(self, user_id: str) -> User | None:
        return self.session.get(User, user_id)

    def resolve_feishu_user(
        self,
        *,
        union_id: str,
        open_id: str,
        verified_email: str,
    ) -> User | None:
        identity = self.session.scalar(
            select(FeishuIdentity).where(FeishuIdentity.union_id == union_id)
        )
        if identity:
            if not identity.user.is_active:
                return None
            identity.open_id = open_id
            return identity.user

        normalized_email = verified_email.strip().lower()
        if not normalized_email:
            return None
        user = self.session.scalar(
            select(User).where(
                func.lower(User.email) == normalized_email,
                User.is_active.is_(True),
            )
        )
        if not user or user.feishu_identity:
            return None

        user.feishu_identity = FeishuIdentity(
            union_id=union_id,
            open_id=open_id,
        )
        self.session.flush()
        return user
