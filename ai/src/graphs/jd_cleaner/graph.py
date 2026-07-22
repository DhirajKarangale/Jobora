from typing import TypedDict, Dict, Any
from langgraph.graph import StateGraph, START, END

from utils.huggingface import invoke_llm
from graphs.jd_cleaner.prompts import (
    get_cleaning_prompt,
    get_structuring_prompt,
)

# Model fallback lists
CLEANING_MODELS = [
    "llama3",
    "qwen2_5",
    "qwen2_5_7b",
    "deepseek_r1_distill_llama_8b",
    "hermes",
    "mistral",
    "phi3_mini",
    "gemma_7b",
    "zephyr",
]

STRUCTURING_MODELS = [
    "qwen2_5",
    "llama3",
    "qwen2_5_7b",
    "deepseek_r1_distill_llama_8b",
    "hermes",
    "deepseek_v3",
    "phi3_mini",
    "gemma_7b",
    "zephyr",
]

class JDState(TypedDict):
    raw_text: str
    current_text: str
    structured_data: Dict[str, Any]


def run_llm_step(text: str, prompt: str, models: list[str]) -> str:
    """Helper to run the LLM with fallback models."""
    if not text or not text.strip():
        return ""
    try:
        result = invoke_llm(models, prompt, parse_as_json=False)
        return result.strip() if result else text
    except Exception as e:
        print(f"LLM Step failed: {e}")
        return text


def run_llm_json_step(text: str, prompt: str, models: list[str]) -> Dict[str, Any]:
    """Helper to run LLM and parse JSON with fallback models."""
    if not text or not text.strip():
        return {}
    try:
        result = invoke_llm(models, prompt, parse_as_json=True)
        if isinstance(result, dict):
            return result
        return {}
    except Exception as e:
        print(f"LLM JSON Step failed: {e}")
        return {}


# --- Graph Nodes ---

def text_cleaning_node(state: JDState) -> JDState:
    text = state["current_text"]
    print("[Node] Running text cleaning...")
    prompt = get_cleaning_prompt(text)
    cleaned = run_llm_step(text, prompt, CLEANING_MODELS)
    return {"current_text": cleaned}

def structuring_node(state: JDState) -> JDState:
    text = state["current_text"]
    raw_text = state.get("raw_text", "")
    print("[Node] Running JD structuring node...")
    prompt = get_structuring_prompt(text, raw_text)
    structured_dict = run_llm_json_step(text, prompt, STRUCTURING_MODELS)
    return {"structured_data": structured_dict}


# --- Build Graph ---
builder = StateGraph(JDState)

builder.add_node("text_cleaning", text_cleaning_node)
builder.add_node("structuring", structuring_node)

builder.add_edge(START, "text_cleaning")
builder.add_edge("text_cleaning", "structuring")
builder.add_edge("structuring", END)

jd_cleaner_graph = builder.compile()

from utils.parser import sanitize_data

def process_job_description(raw_text: str) -> Dict[str, Any]:
    """Entry point for the whole workflow. Returns the sanitized structured JSON data directly."""
    if not raw_text:
        return {}
    initial_state = {"raw_text": raw_text, "current_text": raw_text, "structured_data": {}}
    
    final_state = jd_cleaner_graph.invoke(initial_state)
    structured_data = final_state.get("structured_data", {})
    
    return sanitize_data(structured_data)



