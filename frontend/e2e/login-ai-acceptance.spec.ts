import { expect, test, type Page } from "playwright/test";

const seedText = "The quick brown fox jumps over the lazy dog.";
const selectedText = "quick brown fox";

test("login through AI suggestion acceptance", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("pass123");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL(/\/documents$/);
  await page.getByRole("button", { name: "New document" }).click();

  await expect(page).toHaveURL(/\/documents\/\d+$/);

  const editor = page.getByTestId("document-editor");
  await editor.click();
  await page.keyboard.insertText(seedText);
  await expect(editor).toContainText(seedText);

  await selectTextInEditor(page, selectedText);
  await expect(page.getByText(selectedText, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByRole("button", { name: "Apply suggestion" })).toBeEnabled();
  await expect(page.getByTestId("ai-result-textarea")).toHaveValue(`Rewritten: ${selectedText}`);

  await page.getByRole("button", { name: "Apply suggestion" }).click();

  await expect(page.getByText("AI suggestion applied. Undo is available until your next change.")).toBeVisible();
  await expect(editor).toContainText(`The Rewritten: ${selectedText} jumps over the lazy dog.`);
  await expect(page.getByText("Review: accepted")).toBeVisible();
});

async function selectTextInEditor(page: Page, targetText: string) {
  await page.getByTestId("document-editor").evaluate((editorElement, textToSelect) => {
    const editor = editorElement as HTMLElement;
    editor.focus();

    const textWalker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let currentNode: Node | null = textWalker.nextNode();
    let startNode: Node | null = null;
    let startOffset = 0;

    while (currentNode) {
      const textContent = currentNode.textContent ?? "";
      const matchIndex = textContent.indexOf(textToSelect);
      if (matchIndex >= 0) {
        startNode = currentNode;
        startOffset = matchIndex;
        break;
      }
      currentNode = textWalker.nextNode();
    }

    if (!startNode) {
      throw new Error(`Could not find text "${textToSelect}" in the editor.`);
    }

    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(startNode, startOffset + textToSelect.length);

    const selection = window.getSelection();
    if (!selection) {
      throw new Error("Selection API is unavailable.");
    }

    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
    editor.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    editor.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  }, targetText);
}
