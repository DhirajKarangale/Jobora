from typing import TypedDict, Dict, Any
from langgraph.graph import StateGraph, START, END

from utils.huggingface import invoke_llm
from graphs.jd_cleaner.prompts import (
    get_cleaning_prompt,
    get_semantic_normalization_prompt,
    get_vocabulary_standardization_prompt,
    get_consistency_prompt,
    get_language_normalization_prompt,
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

NORMALIZATION_MODELS = [
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

def semantic_normalization_node(state: JDState) -> JDState:
    text = state["current_text"]
    print("[Node] Running semantic normalization...")
    prompt = get_semantic_normalization_prompt(text)
    normalized = run_llm_step(text, prompt, NORMALIZATION_MODELS)
    return {"current_text": normalized}

def vocabulary_standardization_node(state: JDState) -> JDState:
    text = state["current_text"]
    print("[Node] Running vocabulary standardization...")
    prompt = get_vocabulary_standardization_prompt(text)
    standardized = run_llm_step(text, prompt, NORMALIZATION_MODELS)
    return {"current_text": standardized}

def consistency_node(state: JDState) -> JDState:
    text = state["current_text"]
    print("[Node] Running consistency check...")
    prompt = get_consistency_prompt(text)
    consistent = run_llm_step(text, prompt, NORMALIZATION_MODELS)
    return {"current_text": consistent}

def language_normalization_node(state: JDState) -> JDState:
    text = state["current_text"]
    print("[Node] Running language normalization...")
    prompt = get_language_normalization_prompt(text)
    final_text = run_llm_step(text, prompt, NORMALIZATION_MODELS)
    return {"current_text": final_text}

def structuring_node(state: JDState) -> JDState:
    text = state["current_text"]
    raw_text = state.get("raw_text", "")
    print("[Node] Running JD structuring node...")
    prompt = get_structuring_prompt(text, raw_text)
    structured_dict = run_llm_json_step(text, prompt, NORMALIZATION_MODELS)
    return {"structured_data": structured_dict}


# --- Build Graph ---
builder = StateGraph(JDState)

builder.add_node("text_cleaning", text_cleaning_node)
builder.add_node("semantic_normalization", semantic_normalization_node)
builder.add_node("vocabulary_standardization", vocabulary_standardization_node)
builder.add_node("consistency", consistency_node)
builder.add_node("language_normalization", language_normalization_node)
builder.add_node("structuring", structuring_node)

builder.add_edge(START, "text_cleaning")
builder.add_edge("text_cleaning", "semantic_normalization")
builder.add_edge("semantic_normalization", "vocabulary_standardization")
builder.add_edge("vocabulary_standardization", "consistency")
builder.add_edge("consistency", "language_normalization")
builder.add_edge("language_normalization", "structuring")
builder.add_edge("structuring", END)

jd_cleaner_graph = builder.compile()

def process_job_description(raw_text: str) -> Dict[str, Any]:
    """Entry point for the whole workflow."""
    if not raw_text:
        return {"current_text": "", "structured_data": {}}
    initial_state = {"raw_text": raw_text, "current_text": raw_text, "structured_data": {}}
    print("Starting job description cleaning & structuring workflow...")
    
    final_state = jd_cleaner_graph.invoke(initial_state)
    
    return {
        "current_text": final_state.get("current_text", ""),
        "structured_data": final_state.get("structured_data", {})
    }

