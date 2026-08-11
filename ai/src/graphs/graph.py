import os
import re
import json
from typing import TypedDict, Dict, Any
from langgraph.graph import StateGraph, START, END

from utils.huggingface import invoke_llm, AllTokensExhaustedException
from graphs.prompts import (
    get_cleaning_prompt,
    get_structuring_prompt,
    get_eligibility_prompt,
)

CLEANING_MODELS = [
    "qwen2_5",
    "llama3_3_70b",
    "deepseek_v3",
    "llama3",
    "deepseek_r1_distill_llama_8b",
    "hermes",
    "mistral",
    "qwen2_5_7b",
    "phi3_mini",
    "gemma_7b",
    "zephyr",
]

STRUCTURING_MODELS = [
    "qwen2_5",
    "llama3_3_70b",
    "deepseek_v3",
    "hermes",
    "llama3",
    "deepseek_r1_distill_llama_8b",
    "qwen2_5_7b",
    "phi3_mini",
    "gemma_7b",
    "zephyr",
]

ELIGIBILITY_MODELS = [
    "qwen2_5",
    "llama3_3_70b",
    "deepseek_v3",
    "deepseek_r1_distill_llama_8b",
    "hermes",
    "llama3",
    "mistral",
    "qwen2_5_7b",
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


from utils.profile_parser import parse_candidate_profile, load_candidate_profile_text, build_evidence_summary

def load_candidate_profile() -> str:
    return load_candidate_profile_text()


def run_llm_step(text: str, prompt: str, models: list[str]) -> str:
    if not text or not text.strip():
        return ""
    try:
        result = invoke_llm(models, prompt, parse_as_json=False)
        return result.strip() if result else text
    except AllTokensExhaustedException:
        raise
    except Exception as e:
        raise RuntimeError(f"LLM cleaning step failed: {str(e)}") from e


def run_llm_json_step(text: str, prompt: str, models: list[str]) -> Dict[str, Any]:
    if not text or not text.strip():
        return {}
    try:
        result = invoke_llm(models, prompt, parse_as_json=True)
        if isinstance(result, dict) and result:
            return result
        raise ValueError("LLM output did not return valid non-empty JSON dict.")
    except AllTokensExhaustedException:
        raise
    except Exception as e:
        raise RuntimeError(f"LLM JSON step failed: {str(e)}") from e


# ---------------------------------------------------------------------------
# Layer 1: Deterministic Hard Filters
# Only genuinely objective checks — explicit experience ceiling &
# unambiguous seniority titles (Staff/Principal/Director/VP/Head).
# ---------------------------------------------------------------------------

def apply_hard_filters(structured_data: Dict[str, Any], raw_text: str = "") -> Dict[str, Any]:
    """Apply minimal deterministic hard filters that are objectively verifiable.
    
    Returns {"override": True, "eligible": "NO", "reason": "..."} to reject,
    or {"override": False} to pass through to semantic evaluation.
    """
    parsed_profile = parse_candidate_profile()
    rules_config = parsed_profile["rules_config"]

    candidate_exp = parsed_profile["candidate_experience"]
    exp_hard_ceiling = rules_config.get("experience_hard_ceiling_years", 5)

    role = str(structured_data.get("role", "")).strip()
    exp_str = str(structured_data.get("experience", "")).strip()
    role_lower = role.lower()

    # 1. Unambiguous Seniority Title Rejection
    #    Only titles that are NEVER appropriate regardless of context.
    #    "Lead" and "Senior" are intentionally excluded — evaluated semantically.
    seniority_hard_reject = rules_config.get("seniority_hard_reject", [])
    for title in seniority_hard_reject:
        title_clean = title.strip().lower()
        if not title_clean:
            continue
        pattern = r'\b' + re.escape(title_clean) + r'\b'
        if re.search(pattern, role_lower):
            return {
                "override": True,
                "eligible": "NO",
                "reason": f"Ineligible: Role title contains unambiguous senior designation '{title_clean}'."
            }

    # 2. Experience Hard Ceiling
    #    Reject if the JD explicitly requires >= experience_hard_ceiling_years.
    #    Only uses the structured experience field (LLM-extracted) for reliability.
    numbers = [int(n) for n in re.findall(r'\d+', exp_str)]
    if numbers:
        min_req_exp = numbers[0]
        if min_req_exp >= exp_hard_ceiling:
            return {
                "override": True,
                "eligible": "NO",
                "reason": f"Ineligible: JD explicitly requires {min_req_exp}+ years (hard ceiling is {exp_hard_ceiling} years, candidate has {candidate_exp})."
            }

    # 3. High experience patterns in raw text as fallback
    #    Catches cases where the structured field missed it.
    full_text_lower = raw_text[:5000].lower() if raw_text else ""
    high_exp_patterns = [
        r'\b([5-9]|\d{2,})\s*\+\s*(?:years?|yrs?)',
        r'\bminimum\s*of\s*([5-9]|\d{2,})\s*(?:years?|yrs?)',
    ]
    for pat in high_exp_patterns:
        match = re.search(pat, full_text_lower)
        if match:
            found_val = int(match.group(1))
            if found_val >= exp_hard_ceiling:
                return {
                    "override": True,
                    "eligible": "NO",
                    "reason": f"Ineligible: Raw text contains high experience requirement: '{match.group(0)}'."
                }

    return {"override": False}


# ---------------------------------------------------------------------------
# Layer 2a: Deterministic Primary Skill Check
# Uses the LLM-extracted primary_defining_skill from the structuring step.
# If a job is defined by a single non-negotiable skill (e.g., Go, C++, Android)
# and the candidate lacks it entirely, reject immediately.
# ---------------------------------------------------------------------------

def check_primary_skill(structured_data: Dict[str, Any], allowed_skills: set) -> Dict[str, Any]:
    """Check if the candidate has the absolute primary defining skill (if one exists)."""
    primary = structured_data.get("primary_defining_skill")
    
    if not primary or str(primary).strip().lower() == "null" or str(primary).strip() == "none" or str(primary).strip() == "":
        return {"override": False}
        
    primary_clean = str(primary).strip().lower()
    
    # Check if primary_clean matches any allowed_skill
    for candidate_skill in allowed_skills:
        if primary_clean == candidate_skill:
            return {"override": False}
        if len(primary_clean) >= 3 and len(candidate_skill) >= 3:
            if primary_clean in candidate_skill or candidate_skill in primary_clean:
                return {"override": False}
                
    return {
        "override": True,
        "eligible": "NO",
        "reason": f"Ineligible: Candidate lacks the primary defining skill '{primary}' which is an absolute requirement for this role."
    }

# ---------------------------------------------------------------------------
# Layer 2b: Deterministic Core Skill Overlap Check
# Uses the LLM-extracted core_skills from the structuring step to verify
# that the candidate has meaningful overlap with the job's CORE requirements.
# This catches obvious mismatches (C++, Golang, Android, CUDA, etc.)
# BEFORE the LLM eligibility call, providing a reliable safety net.
# ---------------------------------------------------------------------------

def check_core_skill_overlap(structured_data: Dict[str, Any], allowed_skills: set) -> Dict[str, Any]:
    """Check if the candidate has meaningful overlap with the job's core skills.
    
    Uses the core_skills extracted by the structuring LLM (not a blacklist).
    This is dynamic — it works for any role because it relies on the structuring
    step correctly identifying what's core vs secondary.
    
    Returns {"override": True, ...} to reject, or {"override": False} to proceed.
    """
    core_skills = structured_data.get("core_skills", [])
    
    # If the structuring step didn't produce core_skills, skip this check
    # (backward compat with old schema that used "skills")
    if not core_skills or not isinstance(core_skills, list):
        return {"override": False}
    
    cleaned_core = [str(s).lower().strip() for s in core_skills if str(s).strip()]
    if len(cleaned_core) < 2:
        return {"override": False}
    
    # Check how many core skills the candidate actually has
    matched = []
    unmatched = []
    for cs in cleaned_core:
        found = False
        for candidate_skill in allowed_skills:
            # Exact match or substring containment (bidirectional)
            if cs == candidate_skill:
                found = True
                break
            if len(cs) >= 3 and len(candidate_skill) >= 3:
                if cs in candidate_skill or candidate_skill in cs:
                    found = True
                    break
        if found:
            matched.append(cs)
        else:
            unmatched.append(cs)
    
    match_ratio = len(matched) / len(cleaned_core) if cleaned_core else 0
    
    # If the candidate matches LESS THAN HALF of the core skills, reject.
    # This is the key gate: if most core skills are missing, the role
    # fundamentally doesn't match, regardless of what the LLM might say.
    if match_ratio < 0.5:
        return {
            "override": True,
            "eligible": "NO",
            "reason": (
                f"Ineligible: Candidate lacks {len(unmatched)}/{len(cleaned_core)} core skills "
                f"required for this role. Missing: {', '.join(unmatched[:8])}. "
                f"Core skill match ratio: {match_ratio:.0%}."
            ),
            "match_ratio": match_ratio,
            "matched": matched,
            "unmatched": unmatched
        }
    
    return {
        "override": False,
        "match_ratio": match_ratio,
        "matched": matched,
        "unmatched": unmatched
    }


# ---------------------------------------------------------------------------
# Layer 3: Post-LLM Programmatic Validation
# Validates the structured JSON output from the LLM semantic evaluation.
# Conservative defaults — any failing dimension triggers rejection.
# ---------------------------------------------------------------------------

def validate_llm_eligibility(llm_result: Dict[str, Any], rules_config: Dict[str, Any]) -> Dict[str, Any]:
    """Programmatically validate the LLM's structured eligibility output.
    
    Applies conservative defaults: any failing dimension → NO.
    Returns the final eligibility result dict with Eligible and Reasoning.
    """
    min_ratio = rules_config.get("core_skill_match_min_ratio", 0.4)

    # Extract fields from LLM output with safe defaults
    role_domain_match = llm_result.get("role_domain_match")
    core_skill_match_ratio = llm_result.get("core_skill_match_ratio")
    seniority_compatible = llm_result.get("seniority_compatible")
    eligible_raw = str(llm_result.get("eligible") or llm_result.get("Eligible") or "").strip().upper()
    reasoning = str(llm_result.get("reasoning") or llm_result.get("Reasoning") or "")
    role_domain = str(llm_result.get("role_domain") or "Unknown")
    
    # Extract missing core skills for validation
    missing_core = llm_result.get("candidate_missing_core_skills", [])
    has_core = llm_result.get("candidate_has_core_skills", [])
    core_required = llm_result.get("core_skills_required", [])

    rejection_reasons = []

    # Check 1: Role domain match
    if role_domain_match is False:
        rejection_reasons.append(f"Role domain '{role_domain}' does not match candidate's experience domain.")

    # Check 2: Core skill match ratio
    if core_skill_match_ratio is not None:
        try:
            ratio = float(core_skill_match_ratio)
            if ratio < min_ratio:
                rejection_reasons.append(
                    f"Core skill match ratio ({ratio:.0%}) is below minimum threshold ({min_ratio:.0%})."
                )
        except (ValueError, TypeError):
            pass

    # Check 3: Missing core skills — if majority of core skills are missing, reject
    if isinstance(missing_core, list) and isinstance(core_required, list):
        if len(core_required) >= 2 and len(missing_core) > len(core_required) / 2:
            rejection_reasons.append(
                f"Candidate missing majority of core skills: {', '.join(str(s) for s in missing_core[:6])}."
            )

    # Check 4: Seniority compatibility
    if seniority_compatible is False:
        rejection_reasons.append("Seniority level is not compatible with candidate's experience.")

    # Check 5: Parse LLM's eligible field with negative bias
    if any(neg in eligible_raw for neg in ["NO", "NOT", "INELIGIBLE", "FALSE", "REJECT"]):
        llm_says_no = True
    elif eligible_raw in ["YES", "TRUE", "ELIGIBLE"] or eligible_raw.startswith("YES"):
        llm_says_no = False
    else:
        # Ambiguous or missing → default NO
        llm_says_no = True

    if llm_says_no:
        rejection_reasons.append("LLM evaluation determined candidate is not eligible.")

    # Final decision: ANY rejection reason → NO
    if rejection_reasons:
        combined_reasoning = reasoning + " | Post-validation: " + "; ".join(rejection_reasons) if reasoning else "; ".join(rejection_reasons)
        return {
            "Eligible": "NO",
            "Reasoning": combined_reasoning,
            "role_domain": role_domain,
            "validation_flags": rejection_reasons
        }

    return {
        "Eligible": "YES",
        "Reasoning": reasoning,
        "role_domain": role_domain,
        "validation_flags": []
    }


# ---------------------------------------------------------------------------
# LangGraph Node Functions
# ---------------------------------------------------------------------------

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

    # NOTE: We intentionally do NOT override the LLM-extracted role with the
    # database role. The LLM should determine the actual role from the JD text.
    # The previous override caused false positives when the DB had a generic
    # role like "Software Engineer" for a job that was actually "Data Engineer".

    return {"structured_data": structured_dict}


def eligibility_node(state: JDState) -> JDState:
    structured_data = state.get("structured_data", {})
    raw_text = state.get("raw_text", "")
    cleaned_text = state.get("current_text", "")

    # Layer 1: Deterministic hard filters (seniority titles, experience ceiling)
    hard_filter_result = apply_hard_filters(structured_data, raw_text=raw_text)
    if hard_filter_result.get("override"):
        return {
            "eligibility_result": {
                "Eligible": "NO",
                "Reasoning": hard_filter_result.get("reason", "Ineligible based on hard filter.")
            },
            "profile_data": state.get("profile_data", "")
        }

    # Load candidate profile and evidence
    parsed_profile = parse_candidate_profile()
    profile_text = state.get("profile_data", "") or load_candidate_profile()
    evidence_summary = parsed_profile.get("evidence_summary", "")
    rules_config = parsed_profile.get("rules_config", {})
    allowed_skills = parsed_profile.get("allowed_skills", set())

    # Layer 2a: Deterministic primary skill check
    # Checks if the role has a single defining skill (e.g., Go, C++) that the candidate lacks
    primary_skill_check = check_primary_skill(structured_data, allowed_skills)
    if primary_skill_check.get("override"):
        return {
            "eligibility_result": {
                "Eligible": "NO",
                "Reasoning": primary_skill_check.get("reason", "Ineligible: primary skill mismatch.")
            },
            "profile_data": profile_text
        }

    # Layer 2b: Deterministic core skill overlap check
    # Uses the LLM-extracted core_skills from structuring to catch obvious
    # mismatches (C++, Golang, Android, CUDA, etc.) BEFORE the LLM call.
    skill_check = check_core_skill_overlap(structured_data, allowed_skills)
    if skill_check.get("override"):
        return {
            "eligibility_result": {
                "Eligible": "NO",
                "Reasoning": skill_check.get("reason", "Ineligible: core skill mismatch.")
            },
            "profile_data": profile_text
        }

    # Layer 2c: LLM semantic evaluation
    prompt = get_eligibility_prompt(structured_data, profile_text, evidence_summary)
    llm_result = run_llm_json_step(cleaned_text, prompt, ELIGIBILITY_MODELS)

    # Layer 3: Post-LLM programmatic validation
    final_result = validate_llm_eligibility(llm_result, rules_config)

    return {
        "eligibility_result": final_result,
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
    else:
        raw_text = str(job_input or "")
        jid = job_id
        sjid = source_job_id

    if not raw_text:
        return {"id": jid, "source_job_id": sjid, "eligible": "NO"}

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
        "source_job_id": sjid,
        "eligible": eligible_val,
        "cleaned_description": final_state.get("current_text", ""),
        "structured_data": final_state.get("structured_data", {})
    }
