import { describe, expect, it } from "vitest";
import { CollaborativeDocumentState } from "./collabCrdt";

describe("CollaborativeDocumentState", () => {
  it("preserves concurrent inserts at the same position", () => {
    const alice = new CollaborativeDocumentState({ title: "Doc", content: "AB" });
    const bob = new CollaborativeDocumentState({ title: "Doc", content: "AB" });

    const insertOne = alice.buildOperations({ title: "Doc", content: "A1B" }, "alice");
    const insertTwo = bob.buildOperations({ title: "Doc", content: "A2B" }, "bob");

    const mergedA = new CollaborativeDocumentState({ title: "Doc", content: "AB" });
    mergedA.applyOperations(insertOne);
    mergedA.applyOperations(insertTwo);

    const mergedB = new CollaborativeDocumentState({ title: "Doc", content: "AB" });
    mergedB.applyOperations(insertTwo);
    mergedB.applyOperations(insertOne);

    expect(mergedA.text().content).toBe(mergedB.text().content);
    expect(["A12B", "A21B"]).toContain(mergedA.text().content);
  });

  it("keeps inserted content when another replica deletes overlapping text", () => {
    const deletingReplica = new CollaborativeDocumentState({ title: "Doc", content: "AB" });
    const insertingReplica = new CollaborativeDocumentState({ title: "Doc", content: "AB" });

    const deleteB = deletingReplica.buildOperations({ title: "Doc", content: "A" }, "alice");
    const insertX = insertingReplica.buildOperations({ title: "Doc", content: "AXB" }, "bob");

    const merged = new CollaborativeDocumentState({ title: "Doc", content: "AB" });
    merged.applyOperations(deleteB);
    merged.applyOperations(insertX);

    expect(merged.text().content).toBe("AX");
  });
});
