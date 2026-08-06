from typing import Literal

from pydantic import BaseModel, Field

SourceKind = Literal["markdown", "excel", "mindmap"]
IssueCode = Literal[
    "empty_item",
    "empty_answer",
    "empty_sheet",
    "duplicate",
    "conflict",
    "parse_error",
]


class SourceLocator(BaseModel):
    source_path: str
    kind: SourceKind
    anchor: str
    line: int | None = None
    sheet: str | None = None
    row: int | None = None
    node_id: str | None = None
    path: list[str] = Field(default_factory=list)


class SourceInput(BaseModel):
    source_path: str
    kind: SourceKind
    content: bytes


class RawKnowledgeUnit(BaseModel):
    title: str
    content: str
    category_path: list[str]
    semantic_key: str | None = None
    source: SourceLocator


class KnowledgeUnitValue(BaseModel):
    id: str = Field(pattern=r"^ku_[a-f0-9]{24}$")
    title: str
    content: str
    category_path: list[str]
    semantic_key: str | None = None
    content_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    sources: list[SourceLocator]


class ParseIssue(BaseModel):
    code: IssueCode
    severity: Literal["info", "warning", "error"]
    message: str
    sources: list[SourceLocator]


class ParseResult(BaseModel):
    units: list[RawKnowledgeUnit] = Field(default_factory=list)
    issues: list[ParseIssue] = Field(default_factory=list)
    stats: dict[str, int] = Field(default_factory=dict)


class SourceManifest(BaseModel):
    source_path: str
    kind: SourceKind
    source_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    bytes: int
    stats: dict[str, int]


class CoverageCheck(BaseModel):
    name: str
    expected: int
    actual: int
    passed: bool


class CoverageGate(BaseModel):
    passed: bool
    checks: list[CoverageCheck]


class KnowledgePack(BaseModel):
    schema_version: Literal[1] = 1
    pack_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    source_root: str
    sources: list[SourceManifest]
    units: list[KnowledgeUnitValue]
    issues: list[ParseIssue]
    coverage: dict[str, int]
    gate: CoverageGate
