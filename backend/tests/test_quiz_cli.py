import json
import subprocess
import sys
from pathlib import Path


def test_quiz_cli_validates_a_publication_file(tmp_path: Path) -> None:
    payload = {
        "schema_version": 1,
        "knowledge_version_hash": "a" * 64,
        "topics": [
            {
                "id": "returns",
                "label": "退换货",
                "description": "售后专题",
                "passing_score": 80,
                "quiz_hash": "b" * 64,
                "questions": [
                    {
                        "id": "question-1",
                        "knowledge_unit_key": "unit-1",
                        "question_type": "true_false",
                        "prompt": "支持七天退换货。",
                        "options": ["正确", "错误"],
                        "correct_answers": ["正确"],
                        "explanation": "依据售后政策。",
                        "category": "returns",
                        "difficulty": "easy",
                        "position": 1,
                    }
                ],
            }
        ],
    }
    source = tmp_path / "quiz.json"
    source.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    result = subprocess.run(
        [sys.executable, "scripts/quiz.py", "validate", str(source)],
        cwd=Path(__file__).parents[1],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0
    assert json.loads(result.stdout) == {"topic_count": 1, "question_count": 1}
