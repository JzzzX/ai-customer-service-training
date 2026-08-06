import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import get_database
from app.services.quiz.publication import QuizPublicationInput, QuizPublicationService


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate and publish quiz topics.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    for command in ("validate", "publish"):
        command_parser = subparsers.add_parser(command)
        command_parser.add_argument("payload", type=Path)
    arguments = parser.parse_args()
    payload = QuizPublicationInput.model_validate_json(
        arguments.payload.read_text(encoding="utf-8")
    )
    if arguments.command == "validate":
        print(
            json.dumps(
                {
                    "topic_count": len(payload.topics),
                    "question_count": sum(
                        len(topic.questions) for topic in payload.topics
                    ),
                },
                ensure_ascii=False,
            )
        )
        return 0
    with get_database().session_scope() as session:
        result = QuizPublicationService(session).publish(payload)
    print(json.dumps(asdict(result), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
