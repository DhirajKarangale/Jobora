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


from utils.profile_parser import parse_candidate_profile, load_candidate_profile_text

def load_candidate_profile() -> str:
    return load_candidate_profile_text()


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


def verify_eligibility_rules(structured_data: Dict[str, Any], raw_text: str = "", candidate_exp: int = None) -> Dict[str, Any]:
    parsed_profile = parse_candidate_profile()
    
    if candidate_exp is None:
        candidate_exp = parsed_profile["candidate_experience"]
        
    rules_config = parsed_profile["rules_config"]
    allowed_skills = parsed_profile["allowed_skills"]
    target_roles = parsed_profile["target_roles"]

    exp_buffer = rules_config.get("experience_buffer_years", 1)
    max_allowed_min_exp = candidate_exp + exp_buffer

    role = str(structured_data.get("role", "")).strip()
    exp_str = str(structured_data.get("experience", "")).strip()
    skills = structured_data.get("skills", [])
    
    full_text_sample = f"{role} {exp_str} {raw_text[:2000]}".lower()
    role_lower = role.lower()

    seniority_titles = rules_config.get("seniority_titles", [])
    for st in seniority_titles:
        if st in role_lower:
            return {
                "override": True,
                "eligible": "NO",
                "reason": f"Ineligible due to high seniority title: '{role}'."
            }

    numbers = [int(n) for n in re.findall(r'\d+', exp_str)]
    if numbers:
        min_req_exp = numbers[0]
        if min_req_exp > max_allowed_min_exp:
            return {
                "override": True,
                "eligible": "NO",
                "reason": f"Ineligible due to experience requirement: JD requires {min_req_exp}+ years of experience (Candidate has {candidate_exp} yrs)."
            }

    high_exp_patterns = [
        r'\b([4-9]|\d{2,})\s*\+\s*(?:years?|yrs?)',
        r'\b([4-9]|\d{2,})\s*(?:to|-)\s*\d+\s*(?:years?|yrs?)',
        r'\bminimum\s*of\s*([4-9]|\d{2,})\s*(?:years?|yrs?)',
    ]
    for pat in high_exp_patterns:
        match = re.search(pat, full_text_sample)
        if match:
            found_val = int(match.group(1))
            if found_val > max_allowed_min_exp:
                return {
                    "override": True,
                    "eligible": "NO",
                    "reason": f"Ineligible due to high experience pattern in JD: '{match.group(0)}'."
                }

    dealbreaker_categories = rules_config.get("dealbreaker_categories", {})
    all_dealbreakers = set()
    for cat_items in dealbreaker_categories.values():
        all_dealbreakers.update(cat_items)

    for db in all_dealbreakers:
        if re.search(r'\b' + re.escape(db) + r'\b', role_lower):
            return {
                "override": True,
                "eligible": "NO",
                "reason": f"Ineligible due to dealbreaker domain/role: '{role}' (matches '{db}')."
            }

    if isinstance(skills, list):
        for raw_skill in skills:
            s_lower = str(raw_skill).lower().strip()
            if s_lower in ["c", "c/c++"]:
                return {
                    "override": True,
                    "eligible": "NO",
                    "reason": f"Ineligible due to dealbreaker skill: '{raw_skill}'."
                }
            for dbs in all_dealbreakers:
                if dbs == s_lower or re.search(r'\b' + re.escape(dbs) + r'\b', s_lower):
                    return {
                        "override": True,
                        "eligible": "NO",
                        "reason": f"Ineligible due to dealbreaker skill: '{raw_skill}'."
                    }

    critical_text_dealbreakers = rules_config.get("critical_text_dealbreakers", [])
    for ctd in critical_text_dealbreakers:
        if ctd in full_text_sample:
            return {
                "override": True,
                "eligible": "NO",
                "reason": f"Ineligible due to critical dealbreaker stack in text: '{ctd}'."
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
    
    safety_check = verify_eligibility_rules(structured_data, raw_text=raw_text)
    if safety_check.get("override"):
        return {
            "eligibility_result": {
                "Eligible": "NO",
                "Reasoning": safety_check.get("reason", "Ineligible based on rule guard.")
            },
            "profile_data": state.get("profile_data", "")
        }

    profile_text = state.get("profile_data", "")
    if not profile_text:
        profile_text = load_candidate_profile()

    prompt = get_eligibility_prompt(structured_data, profile_text)
    llm_res = run_llm_json_step(cleaned_text, prompt, ELIGIBILITY_MODELS)

    raw_val = str(llm_res.get("Eligible") or llm_res.get("eligible") or "").upper()
    reasoning_val = str(llm_res.get("Reasoning") or llm_res.get("reasoning") or "")
    final_eligible = "YES" if "YES" in raw_val or ("ELIGIBLE" in raw_val and "INELIGIBLE" not in raw_val) else "NO"

    return {
        "eligibility_result": {
            "Eligible": final_eligible,
            "Reasoning": reasoning_val
        },
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


def process_job_description(job_input: Any, job_id: str = "", source_job_id: str = "") -> Dict[str, Any]:
    if isinstance(job_input, dict):
        raw_text = job_input.get("description", "")
        jid = str(job_input.get("id", job_id))
        sjid = str(job_input.get("source_job_id", source_job_id))
        role = str(job_input.get("role", ""))
    else:
        raw_text = str(job_input or "")
        jid = job_id
        sjid = source_job_id
        role = ""

    if not raw_text:
        return {"id": jid, "source_job_id": sjid, "eligible": "NO"}

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
        "source_job_id": sjid,
        "eligible": eligible_val,
        "cleaned_description": final_state.get("current_text", ""),
        "structured_data": final_state.get("structured_data", {})
    }
