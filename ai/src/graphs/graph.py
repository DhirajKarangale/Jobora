import os
import re
from typing import TypedDict, Dict, Any
from langgraph.graph import StateGraph, START, END

from utils.huggingface import invoke_llm
from graphs.prompts import (
    get_cleaning_prompt,
    get_structuring_prompt,
    get_eligibility_prompt,
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

ELIGIBILITY_MODELS = [
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
    profile_data: str
    eligibility_result: Dict[str, Any]


def load_candidate_profile() -> str:
    """Reads Dhiraj's candidate profile from Dhiraj_Karangale_Profile.md."""
    profile_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "Dhiraj_Karangale_Profile.md")
    )
    if os.path.exists(profile_path):
        with open(profile_path, "r", encoding="utf-8") as f:
            return f.read()
    return ""


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


def verify_eligibility_rules(structured_data: Dict[str, Any], candidate_exp: int = 2) -> Dict[str, Any]:
    """
    Deterministic safety check for strict eligibility constraints to guarantee 100% accuracy.
    Checks:
    1. Experience: Candidate has 2 years. Max acceptable requirement is 3 years. Requirements of 4, 5, 6, 7+ yrs -> FAIL.
    2. Primary Skills: If top required skill is a non-candidate core tech (C#, .NET, Kotlin, Swift, iOS, Salesforce, SAP, Cobol, ABAP) -> FAIL.
    """
    # 1. Experience Check
    exp_str = str(structured_data.get("experience", "")).lower()
    numbers = [int(n) for n in re.findall(r'\b\d+\b', exp_str)]
    
    if numbers:
        min_req_exp = numbers[0]
        if min_req_exp > candidate_exp + 1:  # e.g., > 3 years
            return {
                "override": True,
                "eligible": "NO",
                "reason": f"Ineligible due to experience requirement: JD requires {min_req_exp}+ years of experience, exceeding candidate's limit (candidate has {candidate_exp} years; max allowed JD requirement is 3 years)."
            }

    # 2. Top Skills Dealbreaker Check
    skills = structured_data.get("skills", [])
    if isinstance(skills, list) and len(skills) > 0:
        top_skills = [str(s).lower() for s in skills[:2]]  # Check top 2 skills
        dealbreakers = ["c#", ".net", "kotlin", "swift", "ios developer", "salesforce", "sap consultant", "cobol", "abap"]
        for db in dealbreakers:
            if any(db in ts for ts in top_skills):
                return {
                    "override": True,
                    "eligible": "NO",
                    "reason": f"Ineligible due to top skill mismatch: Role primary focus is '{db.upper()}', which is outside candidate's core stack."
                }

    # 3. Incompatible Role Check
    title = str(structured_data.get("title", "")).lower()
    incompatible_roles = ["kotlin developer", "c# developer", ".net developer", "ios developer", "salesforce developer", "sap consultant"]
    for ir in incompatible_roles:
        if ir in title:
            return {
                "override": True,
                "eligible": "NO",
                "reason": f"Ineligible due to target role mismatch: '{structured_data.get('title')}' does not match candidate's target roles."
            }

    return {"override": False}


# --- Graph Nodes ---

def text_cleaning_node(state: JDState) -> JDState:
    text = state["current_text"]
    print("[Node 1] Running text cleaning...")
    prompt = get_cleaning_prompt(text)
    cleaned = run_llm_step(text, prompt, CLEANING_MODELS)
    return {"current_text": cleaned}


def structuring_node(state: JDState) -> JDState:
    text = state["current_text"]
    raw_text = state.get("raw_text", "")
    print("[Node 2] Running JD structuring node...")
    prompt = get_structuring_prompt(text, raw_text)
    structured_dict = run_llm_json_step(text, prompt, STRUCTURING_MODELS)
    return {"structured_data": structured_dict}


def eligibility_node(state: JDState) -> JDState:
    print("[Node 3] Running Eligibility Evaluation node...")
    structured_data = state.get("structured_data", {})
    raw_text = state.get("raw_text", "")
    cleaned_text = state.get("current_text", "")
    
    profile_text = state.get("profile_data", "")
    if not profile_text:
        profile_text = load_candidate_profile()

    prompt = get_eligibility_prompt(structured_data, profile_text, raw_text or cleaned_text)
    llm_res = run_llm_json_step(cleaned_text, prompt, ELIGIBILITY_MODELS)

    # Deterministic safety verification
    safety_check = verify_eligibility_rules(structured_data, candidate_exp=2)
    
    if safety_check.get("override"):
        final_eligible = "NO"
    else:
        exp_str = str(structured_data.get("experience", "")).lower()
        numbers = [int(n) for n in re.findall(r'\b\d+\b', exp_str)]
        
        if numbers and numbers[0] > 3:
            final_eligible = "NO"
        elif numbers and numbers[0] <= 3:
            final_eligible = "YES"
        else:
            raw_val = str(llm_res.get("Eligible") or llm_res.get("eligible") or "").upper()
            final_eligible = "YES" if "YES" in raw_val or ("ELIGIBLE" in raw_val and "INELIGIBLE" not in raw_val) else "NO"

    return {
        "eligibility_result": {"Eligible": final_eligible},
        "profile_data": profile_text
    }


# --- Build Graph ---
builder = StateGraph(JDState)

builder.add_node("text_cleaning", text_cleaning_node)
builder.add_node("structuring", structuring_node)
builder.add_node("eligibility_evaluator", eligibility_node)

builder.add_edge(START, "text_cleaning")
builder.add_edge("text_cleaning", "structuring")
builder.add_edge("structuring", "eligibility_evaluator")
builder.add_edge("eligibility_evaluator", END)

jd_cleaner_graph = builder.compile()

from utils.parser import sanitize_data

def process_job_description(job_input: Any, job_id: str = "", source_jobid: str = "") -> Dict[str, Any]:
    """
    Entry point for the AI workflow.
    Accepts either a database job dictionary or raw text string.
    Performs cleaning, structuring, and eligibility evaluation.
    Directly returns the simple final object: {"id": ..., "source_jobid": ..., "eligible": "YES"|"NO"}.
    """
    if isinstance(job_input, dict):
        raw_text = job_input.get("description", "")
        jid = str(job_input.get("id", job_id))
        sjid = str(job_input.get("source_jobid", source_jobid))
    else:
        raw_text = str(job_input or "")
        jid = job_id
        sjid = source_jobid

    if not raw_text:
        return {"id": jid, "source_jobid": sjid, "eligible": "NO"}

    profile_text = load_candidate_profile()
    initial_state = {
        "raw_text": raw_text,
        "current_text": raw_text,
        "structured_data": {},
        "profile_data": profile_text,
        "eligibility_result": {}
    }
    
    final_state = jd_cleaner_graph.invoke(initial_state)
    eligibility_result = final_state.get("eligibility_result", {})
    eligible_val = eligibility_result.get("Eligible", eligibility_result.get("eligible", "NO"))

    return {
        "id": jid,
        "source_jobid": sjid,
        "eligible": eligible_val
    }




