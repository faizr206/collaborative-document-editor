PROMPT_TEMPLATES = {
    "rewrite": (
        "You are an AI writing assistant inside a collaborative document editor.\n"
        "Rewrite the selected text according to the user's instruction.\n\n"
        "Instruction: {instruction}\n"
        "Context: {context}\n"
        "Selected text:\n{source_text}"
    ),
    "summarize": (
        "You are an AI writing assistant inside a collaborative document editor.\n"
        "Summarize the selected text clearly and concisely.\n\n"
        "Context: {context}\n"
        "Selected text:\n{source_text}"
    ),
}