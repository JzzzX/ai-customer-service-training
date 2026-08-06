from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import Base, FeishuIdentity, User
from app.repositories.users import UserRepository


def session() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def test_binds_first_feishu_login_to_the_unique_active_email() -> None:
    database = session()
    database.add(
        User(
            id="00000000-0000-4000-8000-000000000002",
            email="learner@example.test",
            name="测试学员",
            role="learner",
            is_active=True,
        )
    )
    database.commit()

    user = UserRepository(database).resolve_feishu_user(
        union_id="on_union_1",
        open_id="ou_open_1",
        verified_email="LEARNER@example.test",
    )
    database.commit()

    assert user.id == "00000000-0000-4000-8000-000000000002"
    identity = database.query(FeishuIdentity).one()
    assert identity.union_id == "on_union_1"
    assert identity.open_id == "ou_open_1"


def test_existing_union_id_remains_authoritative_when_email_changes() -> None:
    database = session()
    user = User(
        id="00000000-0000-4000-8000-000000000002",
        email="learner@example.test",
        name="测试学员",
        role="learner",
        is_active=True,
    )
    user.feishu_identity = FeishuIdentity(
        union_id="on_union_1",
        open_id="ou_old",
    )
    database.add(user)
    database.commit()

    resolved = UserRepository(database).resolve_feishu_user(
        union_id="on_union_1",
        open_id="ou_new",
        verified_email="different@example.test",
    )

    assert resolved.id == user.id
    assert resolved.feishu_identity.open_id == "ou_new"


def test_rejects_unmatched_or_inactive_email() -> None:
    database = session()
    database.add(
        User(
            id="00000000-0000-4000-8000-000000000002",
            email="disabled@example.test",
            name="停用学员",
            role="learner",
            is_active=False,
        )
    )
    database.commit()

    repository = UserRepository(database)

    assert (
        repository.resolve_feishu_user(
            union_id="on_union_2",
            open_id="ou_open_2",
            verified_email="disabled@example.test",
        )
        is None
    )
    assert database.query(FeishuIdentity).count() == 0
