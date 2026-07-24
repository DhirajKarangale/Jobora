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
    profile_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "Dhiraj_Karangale_Profile.md")
    )
    if os.path.exists(profile_path):
        with open(profile_path, "r", encoding="utf-8") as f:
            return f.read()
    return ""


def run_llm_step(text: str, prompt: str, models: list[str]) -> str:
    if not text or not text.strip():
        return ""
    try:
        result = invoke_llm(models, prompt, parse_as_json=False)
        return result.strip() if result else text
    except Exception as e:
        return text


def run_llm_json_step(text: str, prompt: str, models: list[str]) -> Dict[str, Any]:
    if not text or not text.strip():
        return {}
    try:
        result = invoke_llm(models, prompt, parse_as_json=True)
        if isinstance(result, dict):
            return result
        return {}
    except Exception as e:
        return {}


def verify_eligibility_rules(structured_data: Dict[str, Any], candidate_exp: int = 2) -> Dict[str, Any]:
    exp_str = str(structured_data.get("experience", "")).lower()
    numbers = [int(n) for n in re.findall(r'\b\d+\b', exp_str)]
    
    if numbers:
        min_req_exp = numbers[0]
        if min_req_exp > candidate_exp + 1:
            return {
                "override": True,
                "eligible": "NO",
                "reason": f"Ineligible due to experience requirement: JD requires {min_req_exp}+ years of experience."
            }

    skills = structured_data.get("skills", [])
    if isinstance(skills, list) and len(skills) > 0:
        top_skills = [str(s).lower() for s in skills[:2]]
        dealbreakers = ["c#", ".net", "kotlin", "swift", "ios developer", "salesforce", "sap consultant", "cobol", "abap"]
        for db in dealbreakers:
            if any(db in ts for ts in top_skills):
                return {
                    "override": True,
                    "eligible": "NO",
                    "reason": f"Ineligible due to top skill mismatch: '{db.upper()}'."
                }

    role = str(structured_data.get("role", "")).lower()
    incompatible_roles = ["kotlin developer", "c# developer", ".net developer", "ios developer", "salesforce developer", "sap consultant"]
    for ir in incompatible_roles:
        if ir in role:
            return {
                "override": True,
                "eligible": "NO",
                "reason": f"Ineligible due to target role mismatch: '{structured_data.get('role')}'."
            }

    return {"override": False}


def text_cleaning_node(state: JDState) -> JDState:
    text = state["current_text"]
    prompt = get_cleaning_prompt(text)
    cleaned = run_llm_step(text, prompt, CLEANING_MODELS)
    return {"current_text": cleaned}


def structuring_node(state: JDState) -> JDState:
    text = state["current_text"]
    raw_text = state.get("raw_text", "")
    prompt = get_structuring_prompt(text, raw_text)
    structured_dict = run_llm_json_step(text, prompt, STRUCTURING_MODELS)
    
    existing_role = state.get("structured_data", {}).get("role", "")
    if existing_role:
        structured_dict["role"] = existing_role
        
    return {"structured_data": structured_dict}


def eligibility_node(state: JDState) -> JDState:
    structured_data = state.get("structured_data", {})
    raw_text = state.get("raw_text", "")
    cleaned_text = state.get("current_text", "")
    
    profile_text = state.get("profile_data", "")
    if not profile_text:
        profile_text = load_candidate_profile()

    prompt = get_eligibility_prompt(structured_data, profile_text)
    llm_res = run_llm_json_step(cleaned_text, prompt, ELIGIBILITY_MODELS)

    safety_check = verify_eligibility_rules(structured_data, candidate_exp=2)
    
    if safety_check.get("override"):
        final_eligible = "NO"
    else:
        exp_str = str(structured_data.get("experience", "")).lower()
        numbers = [int(n) for n in re.findall(r'\b\d+\b', exp_str)]
        
        if numbers and numbers[0] > 3:
            final_eligible = "NO"
        else:
            raw_val = str(llm_res.get("Eligible") or llm_res.get("eligible") or "").upper()
            final_eligible = "YES" if "YES" in raw_val or ("ELIGIBLE" in raw_val and "INELIGIBLE" not in raw_val) else "NO"

    return {
        "eligibility_result": {"Eligible": final_eligible},
        "profile_data": profile_text
    }


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
    if isinstance(job_input, dict):
        raw_text = job_input.get("description", "")
        jid = str(job_input.get("id", job_id))
        sjid = str(job_input.get("source_jobid", source_jobid))
        role = str(job_input.get("role", ""))
    else:
        raw_text = str(job_input or "")
        jid = job_id
        sjid = source_jobid
        role = ""

    if not raw_text:
        return {"id": jid, "source_jobid": sjid, "eligible": "NO"}

    profile_text = load_candidate_profile()
    initial_state = {
        "raw_text": raw_text,
        "current_text": raw_text,
        "structured_data": {"role": role} if role else {},
        "profile_data": profile_text,
        "eligibility_result": {}
    }
    
    final_state = jd_cleaner_graph.invoke(initial_state)
    eligibility_result = final_state.get("eligibility_result", {})
    eligible_val = eligibility_result.get("Eligible", eligibility_result.get("eligible", "NO"))

    return {
        "id": jid,
        "source_jobid": sjid,
        "eligible": eligible_val,
        "cleaned_description": final_state.get("current_text", ""),
        "structured_data": final_state.get("structured_data", {})
    }
