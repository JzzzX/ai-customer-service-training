from io import BytesIO

from openpyxl import Workbook

from app.services.knowledge.adapters import (
    parse_excel,
    parse_markdown,
    parse_mindmap,
)
from app.services.knowledge.compiler import compile_knowledge_sources
from app.services.knowledge.normalize import normalize_knowledge_text
from app.services.knowledge.schema import SourceInput


def workbook_bytes(rows: list[list[str]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "FAQ"
    for row in rows:
        sheet.append(row)
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def test_adapters_preserve_source_locations_and_skip_empty_content() -> None:
    markdown = parse_markdown(
        "knowledge/faq.md",
        "# 售后\n## 退换货\n签收后七天。 ![截图](answer.png)\n## 空白\n",
    )
    excel = parse_excel(
        "knowledge/faq.xlsx",
        workbook_bytes(
            [
                ["分类", "问题", "回复"],
                ["物流", "多久发货？", "48 小时内"],
                ["物流", "空答案", ""],
            ]
        ),
    )
    mindmap = parse_mindmap(
        "knowledge/map.mm",
        '<map><node ID="root" TEXT="产品"><node ID="child" TEXT="&#x9000;换货"/></node></map>',
    )

    assert normalize_knowledge_text(" A\u200b  B\r\n\r\n\r\nC ") == "A B\n\nC"
    assert [(unit.title, unit.category_path) for unit in markdown.units] == [
        ("退换货", ["售后"])
    ]
    assert markdown.units[0].content == "签收后七天。"
    assert markdown.units[0].source.line == 2
    assert markdown.stats["skipped_images"] == 1
    assert [issue.code for issue in markdown.issues] == ["empty_item", "empty_item"]
    assert excel.units[0].semantic_key == "qa:物流|多久发货？"
    assert excel.units[0].source.sheet == "FAQ"
    assert excel.units[0].source.row == 2
    assert [issue.code for issue in excel.issues] == ["empty_answer"]
    assert [unit.title for unit in mindmap.units] == ["产品", "退换货"]
    assert mindmap.units[1].source.path == ["产品", "退换货"]


def test_compiler_merges_duplicates_and_quarantines_semantic_conflicts() -> None:
    first_excel = workbook_bytes(
        [["分类", "问题", "回复"], ["物流", "多久发货？", "48 小时内"]]
    )
    second_excel = workbook_bytes(
        [["分类", "问题", "回复"], ["物流", "多久发货？", "24 小时内"]]
    )
    sources = [
        SourceInput(
            source_path="b.md",
            kind="markdown",
            content=b"# FAQ\nSame answer",
        ),
        SourceInput(
            source_path="a.md",
            kind="markdown",
            content=b"# FAQ\nSame answer",
        ),
        SourceInput(source_path="a.xlsx", kind="excel", content=first_excel),
        SourceInput(source_path="b.xlsx", kind="excel", content=second_excel),
    ]

    pack = compile_knowledge_sources(
        sources,
        source_root="knowledge",
        expected={"source_files": 4, "markdown_files": 2, "workbook_files": 2},
    )

    assert len(pack.units) == 3
    assert pack.coverage["duplicates_merged"] == 1
    assert pack.coverage["conflicts"] == 1
    assert [issue.code for issue in pack.issues].count("duplicate") == 1
    assert [issue.code for issue in pack.issues].count("conflict") == 1
    assert pack.gate.passed is True


def test_compiler_hash_is_independent_of_source_order() -> None:
    sources = [
        SourceInput(source_path="b.md", kind="markdown", content=b"# B\nBeta"),
        SourceInput(source_path="a.md", kind="markdown", content=b"# A\nAlpha"),
    ]

    forward = compile_knowledge_sources(sources, source_root="knowledge")
    reverse = compile_knowledge_sources(list(reversed(sources)), source_root="knowledge")

    assert forward.pack_hash == reverse.pack_hash
    assert [unit.id for unit in forward.units] == [unit.id for unit in reverse.units]


def test_compiler_fails_coverage_gate_when_expected_source_count_differs() -> None:
    pack = compile_knowledge_sources(
        [SourceInput(source_path="faq.md", kind="markdown", content=b"# FAQ\nAnswer")],
        source_root="knowledge",
        expected={"source_files": 2},
    )

    assert pack.gate.passed is False
    assert pack.gate.checks[0].model_dump() == {
        "name": "source_files",
        "expected": 2,
        "actual": 1,
        "passed": False,
    }
