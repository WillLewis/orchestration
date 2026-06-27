import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BASELINE = json.loads((ROOT / "api/tests/fixtures/beats_7_8_baseline.json").read_text())


def _balanced_from(text: str, open_index: int) -> str:
    open_to_close = {"{": "}", "[": "]", "(": ")"}
    stack: list[str] = []
    quote: str | None = None
    escaped = False
    line_comment = False
    block_comment = False
    i = open_index

    while i < len(text):
        char = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""

        if line_comment:
            line_comment = char != "\n"
        elif block_comment:
            if char == "*" and nxt == "/":
                block_comment = False
                i += 1
        elif quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
        elif char == "/" and nxt == "/":
            line_comment = True
            i += 1
        elif char == "/" and nxt == "*":
            block_comment = True
            i += 1
        elif char in {'"', "'", "`"}:
            quote = char
        elif char in open_to_close:
            stack.append(open_to_close[char])
        elif stack and char == stack[-1]:
            stack.pop()
            if not stack:
                return text[open_index : i + 1]

        i += 1

    raise AssertionError(f"Unbalanced literal starting at index {open_index}")


def _exported_object(source: str, name: str) -> str:
    marker = f"export const {name}"
    marker_index = source.index(marker)
    assignment_index = source.index("=", marker_index)
    object_index = source.index("{", assignment_index)
    return _balanced_from(source, object_index)


def _field(block: str, key: str) -> Any:
    match = re.search(rf"\b{key}\s*:\s*(null|true|false|-?\d+|\"(?:\\.|[^\"])*\")", block)
    if not match:
        raise AssertionError(f"Missing field {key!r} in block:\n{block[:400]}")

    raw = match.group(1)
    if raw == "null":
        return None
    if raw == "true":
        return True
    if raw == "false":
        return False
    if raw.startswith('"'):
        return json.loads(raw)
    return int(raw)


def _array_field(block: str, key: str) -> str:
    match = re.search(rf"\b{key}\s*:", block)
    if not match:
        raise AssertionError(f"Missing array field {key!r}")
    array_index = block.index("[", match.end())
    return _balanced_from(block, array_index)


def _object_items(array_block: str) -> list[str]:
    items: list[str] = []
    index = 0
    while True:
        object_index = array_block.find("{", index)
        if object_index == -1:
            return items
        item = _balanced_from(array_block, object_index)
        items.append(item)
        index = object_index + len(item)


def _string_array_values(array_block: str) -> list[str]:
    return [json.loads(match.group(0)) for match in re.finditer(r"\"(?:\\.|[^\"])*\"", array_block)]


def _number_array_values(array_block: str) -> list[int]:
    return [int(match.group(0)) for match in re.finditer(r"-?\d+", array_block)]


def _action_state(action: dict[str, Any]) -> str:
    if action["blocked_reason"]:
        return "blocked"
    if action["required_approver"]:
        return "route"
    return "ready"


def _frontend_action_projection() -> list[dict[str, Any]]:
    source = (ROOT / "frontend/src/data/actions.ts").read_text()
    plan = _exported_object(source, "action_plan")
    action_blocks = _object_items(_array_field(plan, "actions"))
    actions = [
        {
            "tool": _field(block, "tool"),
            "required_approver": _field(block, "required_approver"),
            "blocked_reason": _field(block, "blocked_reason"),
        }
        for block in action_blocks
    ]
    return [
        {
            "tool": action["tool"],
            "state": _action_state(action),
            "required_approver": action["required_approver"],
            "blocked_reason": action["blocked_reason"],
        }
        for action in actions
    ]


def _selected_objects(blocks: list[str], keys: tuple[str, ...]) -> list[dict[str, Any]]:
    return [{key: _field(block, key) for key in keys} for block in blocks]


def _frontend_loop_projection() -> dict[str, Any]:
    source = (ROOT / "frontend/src/data/loop.ts").read_text()
    state = _exported_object(source, "loop_state")
    scheduled_blocks = _object_items(_array_field(state, "scheduled"))

    return {
        "assignments": _selected_objects(
            _object_items(_array_field(state, "assignments")),
            ("action_index", "owner_role", "tool"),
        ),
        "replies": _selected_objects(
            _object_items(_array_field(state, "replies")),
            ("action_index", "role", "decision", "message"),
        ),
        "escalations": _selected_objects(
            _object_items(_array_field(state, "escalations")),
            ("action_index", "to", "reason"),
        ),
        "scheduled": [
            {
                "topic": _field(block, "topic"),
                "reason": _field(block, "reason"),
                "attendees": _string_array_values(_array_field(block, "attendees")),
            }
            for block in scheduled_blocks
        ],
        "approved_indices": _number_array_values(_array_field(state, "approved_indices")),
        "closed": _field(state, "closed"),
    }


def test_frontend_action_mock_matches_beats_7_8_baseline():
    assert _frontend_action_projection() == BASELINE["actions"]


def test_frontend_loop_mock_matches_beats_7_8_baseline():
    assert _frontend_loop_projection() == BASELINE["loop"]


def test_no_stale_beats_7_8_copy_in_demo_frontend_or_generated_docs():
    forbidden = {
        "1 item open": re.compile(r"1 item open"),
        "the blocked one": re.compile(r"the blocked one(?!s)"),
        "Three are safe drafts": re.compile(r"Three are safe drafts"),
        "executes three": re.compile(r"executes three"),
    }
    targets = [
        ROOT / "demo-walkthrough.html",
        *sorted((ROOT / "frontend/src").rglob("*.ts")),
        *sorted((ROOT / "frontend/src").rglob("*.tsx")),
        *sorted((ROOT / "api/docs_corpus/generated").glob("*.json")),
    ]

    matches: list[str] = []
    for path in targets:
        text = path.read_text()
        for label, pattern in forbidden.items():
            for match in pattern.finditer(text):
                line = text.count("\n", 0, match.start()) + 1
                matches.append(f"{path.relative_to(ROOT)}:{line}: {label}")

    assert matches == []
