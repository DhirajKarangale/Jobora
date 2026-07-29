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

def parse_candidate_profile() -> Dict[str, Any]:
    profile_text = load_candidate_profile_text()
    rules_config = load_rules_config()
    
    # 1. Dynamic Experience Calculation
    candidate_exp = 2 # Default fallback
    exp_match = re.search(r'(\d+)\+?\s*years(?:\s*of)?\s*(?:full-time)?\s*experience', profile_text, re.IGNORECASE)
    if not exp_match:
        exp_match = re.search(r'Professional Experience\s*\(\s*(\d+)\s*years?\s*\)', profile_text, re.IGNORECASE)
    if exp_match:
        candidate_exp = int(exp_match.group(1))

    # 2. Dynamic Target Roles Parsing
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
                
    # Add common variations/short forms of candidate target roles
    expanded_target_roles: Set[str] = set(target_roles)
    for r in target_roles:
        if "full-stack" in r or "full stack" in r:
            expanded_target_roles.update(["full-stack", "full stack", "fullstack", "fullstack developer", "fullstack engineer"])
        if "frontend" in r or "front-end" in r:
            expanded_target_roles.update(["frontend", "front-end", "frontend developer", "frontend engineer"])
        if "backend" in r or "back-end" in r:
            expanded_target_roles.update(["backend", "back-end", "backend developer", "backend engineer"])
        if "software engineer" in r or "sde" in r:
            expanded_target_roles.update(["software engineer", "sde", "software development engineer", "sde-1", "sde 1", "sde-i", "sde i", "sde-2", "sde 2"])
        if "agentic ai" in r or "ai engineer" in r:
            expanded_target_roles.update(["agentic ai engineer", "ai engineer", "ai developer", "llm engineer"])

    # 3. Dynamic Skills Parsing
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

    # Expand candidate skills with configured aliases
    skill_aliases = rules_config.get("skill_aliases", {})
    expanded_skills: Set[str] = set(raw_skills)
    for raw in raw_skills:
        expanded_skills.add(raw)
        for canon, aliases in skill_aliases.items():
            if raw in aliases or canon == raw:
                expanded_skills.update(aliases)
                expanded_skills.add(canon)

    # Add core common skills from Dhiraj's profile explicitly
    default_profile_skills = {
        "react", "react.js", "reactjs", "typescript", "ts", "javascript", "js",
        "node", "node.js", "nodejs", "express", "express.js", "expressjs",
        "java", "spring", "spring boot", "python", "postgresql", "postgres",
        "mysql", "redis", "mongodb", "sql", "docker", "git", "jenkins",
        "aws", "gcp", "rest", "rest api", "websockets", "langchain", "langgraph",
        "llm", "system design", "dsa", "oop"
    }
    expanded_skills.update(default_profile_skills)

    return {
        "profile_text": profile_text,
        "candidate_experience": candidate_exp,
        "target_roles": expanded_target_roles,
        "allowed_skills": expanded_skills,
        "rules_config": rules_config
    }
