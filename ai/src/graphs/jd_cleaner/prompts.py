def get_cleaning_prompt(text: str) -> str:
    return f"""
Clean the following text by removing formatting issues, fixing extra spaces, and removing non-informative noise (e.g. conversational fillers, useless text).
Ensure the text is structurally clean before further processing.
Do not summarize or change the meaning. Return only the cleaned text.

Text to clean:
{text}
"""

def get_semantic_normalization_prompt(text: str) -> str:
    return f"""
Semantically normalize the following text.
- Make the text clear, consistent, and unambiguous.
- The original meaning and intent must remain unchanged.
- Preserve uncertainty, suggestions, and discussion context (e.g., "Maybe we can add login later" -> "Login was discussed as a possible future requirement").
- Do not convert ideas into confirmed decisions.
Return only the normalized text.

Text to normalize:
{text}
"""

def get_vocabulary_standardization_prompt(text: str) -> str:
    return f"""
Standardize the vocabulary in the following text.
- Use standard terms for the same concept (e.g., replace synonyms and informal terms like "app", "portal", "system" -> "application").
- Canonicalize representations of the same entity into a single canonical form (e.g., names, formats, identifiers).
- Do not change meaning, only standardize representation.
Return only the standardized text.

Text to standardize:
{text}
"""

def get_consistency_prompt(text: str) -> str:
    return f"""
Ensure requirement consistency and reduce ambiguity in the following text.
- Avoid contradictory or duplicated requirements. If conflicts exist, explicitly state when a decision is not finalized (e.g. "Daily reports and later Weekly reports" -> "Reporting frequency was discussed but not finalized").
- Remove vague or unclear statements. Clearly separate known information from unknowns.
- Do not guess or invent missing details.
Return only the consistent text.

Text to process:
{text}
"""

def get_language_normalization_prompt(text: str) -> str:
    return f"""
Normalize the language of the following text.
- Convert informal spoken language into professional text (e.g. "Uh yeah, this kinda doesn't work" -> "The current implementation does not work as expected").
- Improve grammar and readability.
- Maintain original intent.
Return only the normalized professional text.

Text to normalize:
{text}
"""
