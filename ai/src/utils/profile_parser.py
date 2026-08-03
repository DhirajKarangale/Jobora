import os
import re
import json
from typing import Dict, Any, List, Set

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "rules_config.json")
PROFILE_PATH = os.path.abspath(
    os.path.join(BASE_DIR, "..", "..", "Dhiraj_Karangale_Profile.md")
)

def load_rules_config() -> Dict[str, Any]:
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def load_candidate_profile_text() -> str:
    if os.path.exists(PROFILE_PATH):
        with open(PROFILE_PATH, "r", encoding="utf-8") as f:
            return f.read()
    return ""


def _extract_section_lines(lines: List[str], section_header: str) -> List[str]:
    """Extract all content lines under a ## section header until the next ## section."""
    result = []
    in_section = False
    for line in lines:
        line_s = line.strip()
        if line_s.startswith("## ") and section_header.lower() in line_s.lower():
            in_section = True
            continue
        elif line_s.startswith("## ") and in_section:
            break
        if in_section:
            result.append(line)
    return result


def _extract_bullet_items(lines: List[str]) -> List[str]:
    """Extract bullet point items from lines (lines starting with - or *)."""
    items = []
    for line in lines:
        line_s = line.strip()
        if line_s.startswith("-") or line_s.startswith("*"):
            text = line_s.lstrip("-* ").strip()
            if text:
                items.append(text)
    return items


def _extract_experience_evidence(profile_text: str) -> List[str]:
    """Extract professional experience bullet points as evidence of what the candidate has done.
    Filters out metadata lines (title, duration, employment type, location) and only 
    keeps actual work description bullet points.
    """
    lines = profile_text.splitlines()
    exp_lines = _extract_section_lines(lines, "Professional Experience")
    raw_items = _extract_bullet_items(exp_lines)
    
    # Filter out metadata lines that aren't actual work descriptions
    metadata_prefixes = ["duration:", "employment:", "location:", "**duration", "**employment", "**location"]
    evidence = []
    for item in raw_items:
        item_lower = item.lower().strip().rstrip("\\").strip()
        # Skip lines that are just bold titles or metadata
        if item_lower.startswith("**") or item_lower.endswith("**"):
            continue
        if any(item_lower.startswith(prefix) for prefix in metadata_prefixes):
            continue
        # Skip lines that look like metadata (Duration, Location, etc.)
        if re.match(r'^(duration|employment|location|tech|highlights|links)\b', item_lower):
            continue
        # Skip very short items (likely formatting artifacts)
        if len(item_lower) < 20:
            continue
        # Clean trailing backslashes from markdown line breaks
        clean_item = item.rstrip("\\").strip()
        if clean_item:
            evidence.append(clean_item)
    
    return evidence


def _extract_project_evidence(profile_text: str) -> List[str]:
    """Extract project descriptions as evidence of candidate's capabilities."""
    lines = profile_text.splitlines()
    proj_lines = _extract_section_lines(lines, "Projects")
    
    evidence = []
    current_project = None
    
    for line in proj_lines:
        line_s = line.strip()
        if line_s.startswith("### "):
            current_project = line_s.lstrip("# ").strip()
        elif current_project and (line_s.startswith("-") or line_s.startswith("*")):
            text = line_s.lstrip("-* ").strip()
            if not text:
                continue
            text_lower = text.lower().rstrip("\\").strip()
            # Skip URLs, links, bold metadata, and short artifacts
            if text.startswith("http") or text.startswith("Live:") or text.startswith("GitHub:") or text.startswith("npm:"):
                continue
            if text_lower.startswith("**") or text_lower.endswith("**"):
                continue
            if re.match(r'^(tech|highlights|links|live|github|npm)\b', text_lower):
                continue
            if len(text_lower) < 20:
                continue
            evidence.append(f"[{current_project}] {text.rstrip(chr(92)).strip()}")
    
    return evidence


def build_evidence_summary(profile_text: str) -> str:
    """Build a concise evidence summary from the candidate's professional experience and projects."""
    exp_evidence = _extract_experience_evidence(profile_text)
    proj_evidence = _extract_project_evidence(profile_text)
    
    parts = []
    
    if exp_evidence:
        parts.append("PROFESSIONAL EXPERIENCE EVIDENCE:")
        for item in exp_evidence:
            parts.append(f"  - {item}")
    
    if proj_evidence:
        parts.append("\nPROJECT EXPERIENCE EVIDENCE:")
        for item in proj_evidence:
            parts.append(f"  - {item}")
    
    return "\n".join(parts)


def parse_candidate_profile() -> Dict[str, Any]:
    profile_text = load_candidate_profile_text()
    rules_config = load_rules_config()
    
    # Parse experience years
    candidate_exp = rules_config.get("candidate_experience_years", 2)
    exp_match = re.search(r'(\d+)\+?\s*years(?:\s*of)?\s*(?:full-time)?\s*experience', profile_text, re.IGNORECASE)
    if not exp_match:
        exp_match = re.search(r'Professional Experience\s*\(\s*(\d+)\s*years?\s*\)', profile_text, re.IGNORECASE)
    if exp_match:
        candidate_exp = int(exp_match.group(1))

    # Parse target roles
    target_roles: Set[str] = set()
    in_roles_section = False
    for line in profile_text.splitlines():
        line_s = line.strip()
        if line_s.startswith("## Target Roles"):
            in_roles_section = True
            continue
        elif line_s.startswith("## ") and in_roles_section:
            in_roles_section = False
        
        if in_roles_section and (line_s.startswith("-") or line_s.startswith("*")):
            role_text = line_s.lstrip("-* ").strip().lower()
            if role_text:
                target_roles.add(role_text)
                
    expanded_target_roles: Set[str] = set(target_roles)
    for r in target_roles:
        if "full-stack" in r or "full stack" in r or "fullstack" in r:
            expanded_target_roles.update(["full-stack", "full stack", "fullstack", "fullstack developer", "fullstack engineer", "full-stack developer", "full-stack engineer"])
        if "frontend" in r or "front-end" in r:
            expanded_target_roles.update(["frontend", "front-end", "frontend developer", "frontend engineer", "front-end developer", "front-end engineer"])
        if "backend" in r or "back-end" in r:
            expanded_target_roles.update(["backend", "back-end", "backend developer", "backend engineer", "back-end developer", "back-end engineer"])
        if "software engineer" in r or "sde" in r or "software developer" in r:
            expanded_target_roles.update(["software engineer", "sde", "software development engineer", "software developer", "sde-1", "sde 1", "sde-i", "sde i", "sde-2", "sde 2"])
        if "agentic ai" in r or "ai engineer" in r or "ai developer" in r:
            expanded_target_roles.update(["agentic ai engineer", "ai engineer", "ai developer", "llm engineer"])
        if "mern" in r or "web" in r:
            expanded_target_roles.update(["mern stack developer", "mern developer", "web developer", "web engineer"])

    # Parse skills
    raw_skills: Set[str] = set()
    in_skills_section = False
    for line in profile_text.splitlines():
        line_s = line.strip()
        if line_s.startswith("## Skills"):
            in_skills_section = True
            continue
        elif line_s.startswith("## ") and in_skills_section:
            in_skills_section = False
            
        if in_skills_section and (line_s.startswith("-") or line_s.startswith("*")):
            skill_text = line_s.lstrip("-* ").strip().lower()
            if skill_text:
                raw_skills.add(skill_text)

    skill_aliases = rules_config.get("skill_aliases", {})
    expanded_skills: Set[str] = set(raw_skills)
    for raw in raw_skills:
        expanded_skills.add(raw)
        for canon, aliases in skill_aliases.items():
            if raw in aliases or canon == raw:
                expanded_skills.update(aliases)
                expanded_skills.add(canon)

    default_profile_skills = {
        "react", "react.js", "reactjs", "typescript", "ts", "javascript", "js",
        "node", "node.js", "nodejs", "express", "express.js", "expressjs",
        "java", "spring", "spring boot", "python", "postgresql", "postgres",
        "mysql", "redis", "mongodb", "sql", "docker", "git", "jenkins",
        "aws", "gcp", "rest", "rest api", "websockets", "langchain", "langgraph",
        "llm", "system design", "dsa", "oop"
    }
    expanded_skills.update(default_profile_skills)

    # Build evidence summary
    evidence_summary = build_evidence_summary(profile_text)

    return {
        "profile_text": profile_text,
        "candidate_experience": candidate_exp,
        "target_roles": expanded_target_roles,
        "allowed_skills": expanded_skills,
        "rules_config": rules_config,
        "evidence_summary": evidence_summary
    }
