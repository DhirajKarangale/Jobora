import re
import json
import html
import unicodedata
from typing import Dict, Any


def clean_text(raw_text: Any) -> str:
    if hasattr(raw_text, "content"):
        text = raw_text.content
    elif isinstance(raw_text, dict) and "content" in raw_text:
        text = raw_text.get("content", "")
    else:
        text = str(raw_text)

    if not isinstance(text, str) or not text.strip():
        return ""

    # 1. Unescape HTML entities (&amp;, &nbsp;, &lt;, &gt;, &#39;, &quot;, etc.)
    text = html.unescape(text)

    # 2. Remove DeepSeek / Reasoning <think>...</think> tags
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"</?think>", "", text, flags=re.IGNORECASE)

    # 3. Normalize quotes, apostrophes, and Unicode NFKC
    text = text.replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"')
    text = unicodedata.normalize("NFKC", text)

    # 4. Strip non-BMP emojis and high surrogates
    text = re.sub(r'[\U00010000-\U0010ffff]', '', text)

    # 5. Remove conversational model headers / footers
    text = re.sub(r"^(?:here\s+is\s+the\s+cleaned\s+(?:plain\s+)?text:?|here's\s+the\s+cleaned\s+text:?|cleaned\s+job\s+description:?)", "", text, flags=re.IGNORECASE).strip()
    text = re.sub(r"(?:note:\s*i've\s+followed\s+the\s+instructions.*$|here\s+is\s+the\s+normalized\s+text.*$)", "", text, flags=re.IGNORECASE | re.DOTALL).strip()

    # 6. Collapse excessive newlines (\n\n\n+ -> \n\n)
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def sanitize_data(obj: Any) -> Any:
    if isinstance(obj, str):
        return clean_text(obj)
    elif isinstance(obj, list):
        return [sanitize_data(item) for item in obj]
    elif isinstance(obj, dict):
        return {clean_text(str(k)): sanitize_data(v) for k, v in obj.items()}
    return obj


def fix_invalid_json_syntax(json_str: str) -> str:
    """Attempts to repair common LLM JSON syntax errors."""
    # Remove trailing commas before } or ]
    json_str = re.sub(r",\s*([\}\]])", r"\1", json_str)
    # Fix single quotes around keys/values if double quotes are missing
    json_str = re.sub(r"(?<=[{,])\s*'([^'\"]+)'\s*:", r'"\1":', json_str)
    return json_str


def extract_json(raw_text: Any) -> Dict[str, Any]:
    cleaned = clean_text(raw_text)
    cleaned = re.sub(r"```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()

    start = cleaned.find("{")
    end = cleaned.rfind("}")

    if start == -1 or end == -1 or end <= start:
        if "UNVERIFYABLE" in cleaned.upper():
            return {
                "mark": "UNVERIFYABLE",
                "confidence": 100,
                "reason": "Extracted from raw text.",
            }
        elif "VERIFYABLE" in cleaned.upper():
            return {
                "mark": "VERIFYABLE",
                "confidence": 100,
                "reason": "Extracted from raw text.",
            }

        raise ValueError("No JSON object found in model output: " + cleaned[:100])

    json_string = cleaned[start : end + 1]

    # Attempt 1: Standard JSON decode
    try:
        parsed_dict = json.loads(json_string)
        return sanitize_data(parsed_dict)
    except json.JSONDecodeError:
        pass

    # Attempt 2: Auto-repair trailing commas / syntax errors
    fixed_json_string = fix_invalid_json_syntax(json_string)
    try:
        parsed_dict = json.loads(fixed_json_string)
        return sanitize_data(parsed_dict)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to decode JSON after syntax repair: {e}")
