const BASE_DIGIT = 65535;

export type Segment = [number, string, number];
export type Position = Segment[];

export type SerializedNode = {
  id: string;
  value: string;
  position: Position;
};

export type InsertOperation = {
  type: "insert";
  id: string;
  value: string;
  position: Position;
};

export type DeleteOperation = {
  type: "delete";
  id: string;
};

export type SequenceOperation = InsertOperation | DeleteOperation;

export type DocumentOperations = {
  title: SequenceOperation[];
  content: SequenceOperation[];
};

type SequenceNode = {
  id: string;
  value: string;
  position: Position;
};

function compareSegment(left: Segment, right: Segment) {
  if (left[0] !== right[0]) {
    return left[0] - right[0];
  }

  if (left[1] !== right[1]) {
    return left[1] < right[1] ? -1 : 1;
  }

  return left[2] - right[2];
}

function comparePositions(left: Position, right: Position) {
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftSegment = left[index];
    const rightSegment = right[index];

    if (!leftSegment && rightSegment) {
      return -1;
    }

    if (leftSegment && !rightSegment) {
      return 1;
    }

    if (!leftSegment || !rightSegment) {
      continue;
    }

    const difference = compareSegment(leftSegment, rightSegment);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function sortNodes(left: SequenceNode, right: SequenceNode) {
  const byPosition = comparePositions(left.position, right.position);
  if (byPosition !== 0) {
    return byPosition;
  }

  return left.id.localeCompare(right.id);
}

function clonePosition(position: Position): Position {
  return position.map((segment) => [...segment] as Segment);
}

export function allocatePosition(
  left: Position | null,
  right: Position | null,
  actorId: string,
  sequence: number
): Position {
  const prefix: Position = [];
  let index = 0;

  while (true) {
    const leftSegment = left?.[index] ?? null;
    const rightSegment = right?.[index] ?? null;
    const leftDigit = leftSegment?.[0] ?? 0;
    const rightDigit = rightSegment?.[0] ?? BASE_DIGIT;

    if (rightDigit - leftDigit > 1) {
      return [...prefix, [Math.floor((leftDigit + rightDigit) / 2), actorId, sequence]];
    }

    if (!leftSegment) {
      return [...prefix, [0, "", 0], [Math.floor((BASE_DIGIT + 1) / 2), actorId, sequence]];
    }

    prefix.push([...leftSegment] as Segment);
    if (!rightSegment || compareSegment(leftSegment, rightSegment) < 0) {
      return [...prefix, [Math.floor((BASE_DIGIT + 1) / 2), actorId, sequence]];
    }

    index += 1;
  }
}

class SequenceCRDT {
  private nodes = new Map<string, SequenceNode>();
  private counter = 0;

  constructor(text = "", actorId = "bootstrap") {
    if (text) {
      this.loadText(text, actorId);
    }
  }

  clone() {
    const cloned = new SequenceCRDT();
    cloned.counter = this.counter;
    for (const node of this.visibleNodes()) {
      cloned.nodes.set(node.id, {
        id: node.id,
        value: node.value,
        position: clonePosition(node.position)
      });
    }
    return cloned;
  }

  private visibleNodes() {
    return Array.from(this.nodes.values()).sort(sortNodes);
  }

  text() {
    return this.visibleNodes()
      .map((node) => node.value)
      .join("");
  }

  loadState(state: SerializedNode[]) {
    this.nodes.clear();
    for (const node of state) {
      this.nodes.set(node.id, {
        id: node.id,
        value: node.value,
        position: clonePosition(node.position)
      });
    }
  }

  serializeState(): SerializedNode[] {
    return this.visibleNodes().map((node) => ({
      id: node.id,
      value: node.value,
      position: clonePosition(node.position)
    }));
  }

  loadText(text: string, actorId: string) {
    this.nodes.clear();
    this.counter = 0;
    let leftPosition: Position | null = null;

    for (const value of text) {
      this.counter += 1;
      const id = `${actorId}:${this.counter}`;
      const position = allocatePosition(leftPosition, null, actorId, this.counter);
      this.nodes.set(id, { id, value, position });
      leftPosition = position;
    }
  }

  applyOperations(operations: SequenceOperation[]) {
    for (const operation of operations) {
      if (operation.type === "insert") {
        if (this.nodes.has(operation.id)) {
          continue;
        }

        this.nodes.set(operation.id, {
          id: operation.id,
          value: operation.value,
          position: clonePosition(operation.position)
        });
        continue;
      }

      this.nodes.delete(operation.id);
    }
  }

  buildOperationsForText(nextText: string, actorId: string): SequenceOperation[] {
    const currentNodes = this.visibleNodes();
    const currentText = currentNodes.map((node) => node.value).join("");

    if (currentText === nextText) {
      return [];
    }

    let prefixLength = 0;
    const maxPrefix = Math.min(currentText.length, nextText.length);
    while (prefixLength < maxPrefix && currentText[prefixLength] === nextText[prefixLength]) {
      prefixLength += 1;
    }

    let currentSuffix = currentText.length;
    let nextSuffix = nextText.length;
    while (
      currentSuffix > prefixLength &&
      nextSuffix > prefixLength &&
      currentText[currentSuffix - 1] === nextText[nextSuffix - 1]
    ) {
      currentSuffix -= 1;
      nextSuffix -= 1;
    }

    const operations: SequenceOperation[] = currentNodes
      .slice(prefixLength, currentSuffix)
      .map((node) => ({
        type: "delete" as const,
        id: node.id
      }));

    let leftPosition = prefixLength > 0 ? currentNodes[prefixLength - 1]?.position ?? null : null;
    const rightPosition = currentNodes[currentSuffix]?.position ?? null;

    for (const value of nextText.slice(prefixLength, nextSuffix)) {
      this.counter += 1;
      const id = `${actorId}:${this.counter}`;
      const position = allocatePosition(leftPosition, rightPosition, actorId, this.counter);
      operations.push({
        type: "insert",
        id,
        value,
        position
      });
      leftPosition = position;
    }

    this.applyOperations(operations);
    return operations;
  }
}

export class CollaborativeDocumentState {
  private readonly titleSequence: SequenceCRDT;
  private readonly contentSequence: SequenceCRDT;

  constructor(document?: { title: string; content: string }) {
    this.titleSequence = new SequenceCRDT(document?.title ?? "");
    this.contentSequence = new SequenceCRDT(document?.content ?? "");
  }

  text() {
    return {
      title: this.titleSequence.text(),
      content: this.contentSequence.text()
    };
  }

  clone() {
    const cloned = new CollaborativeDocumentState();
    cloned.titleSequence.loadState(this.titleSequence.serializeState());
    cloned.contentSequence.loadState(this.contentSequence.serializeState());
    return cloned;
  }

  loadState(state: { title: SerializedNode[]; content: SerializedNode[] }) {
    this.titleSequence.loadState(state.title);
    this.contentSequence.loadState(state.content);
  }

  serializeState() {
    return {
      title: this.titleSequence.serializeState(),
      content: this.contentSequence.serializeState()
    };
  }

  loadText(document: { title: string; content: string }, actorId: string) {
    this.titleSequence.loadText(document.title, actorId);
    this.contentSequence.loadText(document.content, actorId);
  }

  buildOperations(nextDocument: { title: string; content: string }, actorId: string): DocumentOperations {
    return {
      title: this.titleSequence.buildOperationsForText(nextDocument.title, actorId),
      content: this.contentSequence.buildOperationsForText(nextDocument.content, actorId)
    };
  }

  applyOperations(operations: DocumentOperations) {
    this.titleSequence.applyOperations(operations.title);
    this.contentSequence.applyOperations(operations.content);
  }
}
