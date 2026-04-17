from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypedDict

BASE_DIGIT = 65535
SENTINEL_SEGMENT = (0, "", 0)

Segment = tuple[int, str, int]
Position = tuple[Segment, ...]


class SerializedNode(TypedDict):
    id: str
    value: str
    position: list[list[int | str]]


class InsertOperation(TypedDict):
    type: Literal["insert"]
    id: str
    value: str
    position: list[list[int | str]]


class DeleteOperation(TypedDict):
    type: Literal["delete"]
    id: str


Operation = InsertOperation | DeleteOperation


@dataclass(slots=True)
class SequenceNode:
    id: str
    value: str
    position: Position


def _compare_positions(left: Position, right: Position) -> int:
    for left_segment, right_segment in zip(left, right):
        if left_segment < right_segment:
            return -1
        if left_segment > right_segment:
            return 1

    if len(left) < len(right):
        return -1
    if len(left) > len(right):
        return 1
    return 0


def _sort_key(node: SequenceNode) -> tuple[Position, str]:
    return (node.position, node.id)


def allocate_position(
    left: Position | None,
    right: Position | None,
    actor_id: str,
    sequence: int,
) -> Position:
    prefix: list[Segment] = []
    index = 0

    while True:
        left_segment = left[index] if left and index < len(left) else None
        right_segment = right[index] if right and index < len(right) else None

        left_digit = left_segment[0] if left_segment else 0
        right_digit = right_segment[0] if right_segment else BASE_DIGIT

        if right_digit - left_digit > 1:
            digit = (left_digit + right_digit) // 2
            return tuple(prefix + [(digit, actor_id, sequence)])

        if left_segment is None:
            prefix.append(SENTINEL_SEGMENT)
            return tuple(prefix + [((BASE_DIGIT + 1) // 2, actor_id, sequence)])

        prefix.append(left_segment)
        if right_segment is None or left_segment < right_segment:
            return tuple(prefix + [((BASE_DIGIT + 1) // 2, actor_id, sequence)])

        index += 1


class SequenceCRDT:
    def __init__(self, text: str = ""):
        self._nodes: dict[str, SequenceNode] = {}
        self._counter = 0

        if text:
            self.load_text(text, actor_id="bootstrap")

    def clone(self) -> SequenceCRDT:
        cloned = SequenceCRDT()
        cloned._nodes = {
            node_id: SequenceNode(id=node.id, value=node.value, position=node.position)
            for node_id, node in self._nodes.items()
        }
        cloned._counter = self._counter
        return cloned

    def _sorted_nodes(self) -> list[SequenceNode]:
        return sorted(self._nodes.values(), key=_sort_key)

    def visible_nodes(self) -> list[SequenceNode]:
        return self._sorted_nodes()

    def text(self) -> str:
        return "".join(node.value for node in self._sorted_nodes())

    def serialize_state(self) -> list[SerializedNode]:
        return [
            {
                "id": node.id,
                "value": node.value,
                "position": [list(segment) for segment in node.position],
            }
            for node in self._sorted_nodes()
        ]

    def load_state(self, state: list[SerializedNode]) -> None:
        self._nodes = {}
        for node in state:
            self._nodes[node["id"]] = SequenceNode(
                id=node["id"],
                value=node["value"],
                position=tuple(tuple(segment) for segment in node["position"]),
            )

    def load_text(self, text: str, actor_id: str) -> None:
        self._nodes = {}
        self._counter = 0
        previous_position: Position | None = None

        for character in text:
            self._counter += 1
            node_id = f"{actor_id}:{self._counter}"
            position = allocate_position(
                previous_position, None, actor_id, self._counter
            )
            self._nodes[node_id] = SequenceNode(
                id=node_id, value=character, position=position
            )
            previous_position = position

    def apply_operations(self, operations: list[Operation]) -> None:
        for operation in operations:
            if operation["type"] == "insert":
                if operation["id"] in self._nodes:
                    continue

                self._nodes[operation["id"]] = SequenceNode(
                    id=operation["id"],
                    value=operation["value"],
                    position=tuple(tuple(segment) for segment in operation["position"]),
                )
                continue

            self._nodes.pop(operation["id"], None)

    def build_operations_for_text(
        self, next_text: str, actor_id: str
    ) -> list[Operation]:
        current_nodes = self._sorted_nodes()
        current_text = "".join(node.value for node in current_nodes)

        if current_text == next_text:
            return []

        prefix_length = 0
        max_prefix = min(len(current_text), len(next_text))
        while (
            prefix_length < max_prefix
            and current_text[prefix_length] == next_text[prefix_length]
        ):
            prefix_length += 1

        current_suffix = len(current_text)
        next_suffix = len(next_text)
        while (
            current_suffix > prefix_length
            and next_suffix > prefix_length
            and current_text[current_suffix - 1] == next_text[next_suffix - 1]
        ):
            current_suffix -= 1
            next_suffix -= 1

        operations: list[Operation] = []
        for node in current_nodes[prefix_length:current_suffix]:
            operations.append({"type": "delete", "id": node.id})

        left_position = (
            current_nodes[prefix_length - 1].position if prefix_length > 0 else None
        )
        right_position = (
            current_nodes[current_suffix].position
            if current_suffix < len(current_nodes)
            else None
        )

        for character in next_text[prefix_length:next_suffix]:
            self._counter += 1
            node_id = f"{actor_id}:{self._counter}"
            position = allocate_position(
                left_position, right_position, actor_id, self._counter
            )
            operations.append(
                {
                    "type": "insert",
                    "id": node_id,
                    "value": character,
                    "position": [list(segment) for segment in position],
                }
            )
            left_position = position

        self.apply_operations(operations)
        return operations


class CollaborativeDocument:
    def __init__(self, title: str = "", content: str = ""):
        self.title = SequenceCRDT(title)
        self.content = SequenceCRDT(content)

    def clone(self) -> CollaborativeDocument:
        cloned = CollaborativeDocument()
        cloned.title = self.title.clone()
        cloned.content = self.content.clone()
        return cloned

    def serialize_state(self) -> dict[str, list[SerializedNode]]:
        return {
            "title": self.title.serialize_state(),
            "content": self.content.serialize_state(),
        }

    def plain_text(self) -> dict[str, str]:
        return {
            "title": self.title.text(),
            "content": self.content.text(),
        }

    def build_operations_for_document(
        self,
        *,
        title: str,
        content: str,
        actor_id: str,
    ) -> dict[str, list[Operation]]:
        return {
            "title": self.title.build_operations_for_text(title, actor_id),
            "content": self.content.build_operations_for_text(content, actor_id),
        }

    def apply_operations(self, payload: dict[str, list[Operation]]) -> None:
        self.title.apply_operations(payload.get("title", []))
        self.content.apply_operations(payload.get("content", []))

    @classmethod
    def from_state(
        cls,
        state: dict[str, list[SerializedNode]],
    ) -> CollaborativeDocument:
        document = cls()
        document.title.load_state(state.get("title", []))
        document.content.load_state(state.get("content", []))
        return document
