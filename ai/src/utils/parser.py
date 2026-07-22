import re
import json
from typing import Dict, Any


import unicodedata

def clean_text(raw_text: Any) -> str:
    if hasattr(raw_text, "content"):
        text = raw_text.content
    elif isinstance(raw_text, dict) and "content" in raw_text:
        text = raw_text.get("content", "")
    else:
        text = str(raw_text)

    if not isinstance(text, str):
        return ""

    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"</?think>", "", text, flags=re.IGNORECASE)

    # Normalize unicode characters and replace smart quotes / unicode apostrophes (e.g. \u2019)
    text = text.replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"')
    text = unicodedata.normalize("NFKC", text)

    return text.strip()



def sanitize_data(obj: Any) -> Any:
    """Recursively normalizes unicode apostrophes, smart quotes, and whitespace in strings across dictionaries and lists."""
    if isinstance(obj, str):
        return clean_text(obj)
    elif isinstance(obj, list):
        return [sanitize_data(item) for item in obj]
    elif isinstance(obj, dict):
        return {clean_text(str(k)): sanitize_data(v) for k, v in obj.items()}
    return obj


def extract_json(raw_text: Any) -> Dict[str, Any]:
    """Cleans text and securely extracts a JSON object."""
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

        raise ValueError(
            "No JSON object found in the model output. Output was: " + cleaned[:100]
        )

    json_string = cleaned[start : end + 1]

    try:
        parsed_dict = json.loads(json_string)
        return sanitize_data(parsed_dict)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to decode JSON: {e}")

