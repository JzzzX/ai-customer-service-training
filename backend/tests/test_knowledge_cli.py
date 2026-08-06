import json
import subprocess
import sys
from pathlib import Path


def test_compile_cli_writes_a_valid_pack(tmp_path: Path) -> None:
    source_dir = tmp_path / "knowledge"
    source_dir.mkdir()
    (source_dir / "faq.md").write_text("# 售后\n七天可退换", encoding="utf-8")
    output = tmp_path / "pack.json"

    result = subprocess.run(
        [
            sys.executable,
            "scripts/knowledge.py",
            "compile",
            str(source_dir),
            str(output),
        ],
        cwd=Path(__file__).parents[1],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0
    payload = json.loads(output.read_text(encoding="utf-8"))
    assert payload["gate"]["passed"] is True
    assert payload["coverage"]["source_files"] == 1
    assert json.loads(result.stdout)["pack_hash"] == payload["pack_hash"]


def test_compile_cli_returns_nonzero_for_a_parse_error(tmp_path: Path) -> None:
    source_dir = tmp_path / "knowledge"
    source_dir.mkdir()
    (source_dir / "broken.mm").write_text("<map><node>", encoding="utf-8")
    output = tmp_path / "pack.json"

    result = subprocess.run(
        [
            sys.executable,
            "scripts/knowledge.py",
            "compile",
            str(source_dir),
            str(output),
        ],
        cwd=Path(__file__).parents[1],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 2
    assert json.loads(output.read_text(encoding="utf-8"))["gate"]["passed"] is False
