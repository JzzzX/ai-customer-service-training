from sqlalchemy import text

from app.core.database import Database
from config.settings import Settings


def test_session_scope_executes_queries() -> None:
    database = Database(
        Settings(app_env="test", database_url="sqlite+pysqlite:///:memory:")
    )

    with database.session_scope() as session:
        assert session.execute(text("SELECT 1")).scalar_one() == 1


def test_database_engine_enables_pre_ping() -> None:
    database = Database(
        Settings(app_env="test", database_url="sqlite+pysqlite:///:memory:")
    )

    assert database.engine.pool._pre_ping is True
