import os
import re
import json
from typing import Dict, Any, List, Set

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "rules_config.json")
PROFILE_PATH = os.path.abspath(
    os.path.join(BASE_DIR, "..", "..", "profile", "Dhiraj_Karangale_Profile.md")
)
PROFILE_DIR = os.path.abspath(
    os.path.join(BASE_DIR, "..", "..", "profile")
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
    
    metadata_prefixes = ["duration:", "employment:", "location:", "**duration", "**employment", "**location"]
    evidence = []
    for item in raw_items:
        item_lower = item.lower().strip().rstrip("\\").strip()
        if item_lower.startswith("**") or item_lower.endswith("**"):
            continue
        if any(item_lower.startswith(prefix) for prefix in metadata_prefixes):
            continue
        if re.match(r'^(duration|employment|location|tech|highlights|links)\b', item_lower):
            continue
        if len(item_lower) < 20:
            continue
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


def _extract_target_roles(profile_text: str) -> Set[str]:
    """Extract all target roles from the profile (both bulleted and comma-separated)."""
    roles = set()
    lines = profile_text.splitlines()
    in_roles_section = False
    
    for line in lines:
        line_s = line.strip()
        if line_s.startswith("## ") and "target roles" in line_s.lower():
            in_roles_section = True
            continue
        elif line_s.startswith("## ") and in_roles_section:
            break
            
        if in_roles_section:
            if line_s.startswith("###") or not line_s:
                continue
            cleaned = re.sub(r'^[-*]\s*', '', line_s)
            for part in cleaned.split(','):
                r_clean = part.strip().strip('.').lower()
                if not r_clean:
                    continue
                # Add base role and any sub-tokens in parentheses or slashes
                roles.add(r_clean)
                for sub in re.split(r'[/()]', r_clean):
                    sub_clean = sub.strip()
                    if sub_clean and len(sub_clean) > 1:
                        roles.add(sub_clean)
                        
    return roles


def _extract_profile_skills(profile_text: str) -> Set[str]:
    """Extract granular skills from the profile markdown."""
    skills = set()
    lines = profile_text.splitlines()
    in_skills_section = False
    
    for line in lines:
        line_s = line.strip()
        if line_s.startswith("## ") and "skill" in line_s.lower():
            in_skills_section = True
            continue
        elif line_s.startswith("## ") and in_skills_section:
            break
            
        if in_skills_section:
            if line_s.startswith("###") or not line_s:
                continue
            cleaned = re.sub(r'^[-*]\s*', '', line_s)
            # Remove bold prefixes like **LLM Fundamentals & Inference:**
            cleaned = re.sub(r'^\*\*[^*]+:\*\*\s*', '', cleaned)
            for part in cleaned.split(','):
                part_clean = part.strip().strip('.').lower()
                if part_clean and len(part_clean) > 1:
                    skills.add(part_clean)
                    for sub in re.split(r'[/()]', part_clean):
                        sub_clean = sub.strip()
                        if sub_clean and len(sub_clean) > 1:
                            skills.add(sub_clean)
                            
    return skills


def _extract_resume_skills() -> Set[str]:
    """Extract skills directly from the two active resumes."""
    skills = set()
    resume_files = [
        "Resume_DhirajKarangale_AI.txt",
        "Resume_DhirajKarangale_FullStack.txt"
    ]
    for fn in resume_files:
        fp = os.path.join(PROFILE_DIR, fn)
        if os.path.exists(fp):
            with open(fp, "r", encoding="utf-8") as f:
                content = f.read()
            m = re.search(r'\\section\{Skills\}(.*?)\\section\{', content, re.DOTALL)
            if m:
                sec = m.group(1)
                sec = re.sub(r'\\textbf\{[^}]*\}', '', sec)
                sec = re.sub(r'\\[a-zA-Z]+', ' ', sec)
                for item in re.split(r'[,;\n]', sec):
                    item_clean = re.sub(r'[^a-zA-Z0-9\s\+\#\.\-]', ' ', item).strip().lower()
                    if item_clean and len(item_clean) > 1 and len(item_clean) < 40:
                        skills.add(item_clean)
                        for sub in item_clean.split():
                            if len(sub) >= 3:
                                skills.add(sub)
    return skills


def parse_candidate_profile() -> Dict[str, Any]:
    profile_text = load_candidate_profile_text()
    rules_config = load_rules_config()
    
    # 1. Parse experience years
    candidate_exp = rules_config.get("candidate_experience_years", 2)
    exp_match = re.search(r'(\d+)\+?\s*years(?:\s*of)?\s*(?:full-time)?\s*experience', profile_text, re.IGNORECASE)
    if not exp_match:
        exp_match = re.search(r'Professional Experience\s*\(\s*(\d+)\s*years?\s*\)', profile_text, re.IGNORECASE)
    if exp_match:
        candidate_exp = int(exp_match.group(1))

    # 2. Parse target roles
    raw_target_roles = _extract_target_roles(profile_text)
    expanded_target_roles: Set[str] = set(raw_target_roles)
    for r in raw_target_roles:
        if "full-stack" in r or "full stack" in r or "fullstack" in r:
            expanded_target_roles.update(["full-stack", "full stack", "fullstack", "fullstack developer", "fullstack engineer", "full-stack developer", "full-stack engineer"])
        if "frontend" in r or "front-end" in r:
            expanded_target_roles.update(["frontend", "front-end", "frontend developer", "frontend engineer", "front-end developer", "front-end engineer"])
        if "backend" in r or "back-end" in r:
            expanded_target_roles.update(["backend", "back-end", "backend developer", "backend engineer", "back-end developer", "back-end engineer"])
        if "software engineer" in r or "sde" in r or "software developer" in r:
            expanded_target_roles.update(["software engineer", "sde", "software development engineer", "software developer", "sde-1", "sde 1", "sde-i", "sde i", "sde-2", "sde 2"])
        if "agentic ai" in r or "ai engineer" in r or "ai developer" in r or "generative ai" in r:
            expanded_target_roles.update(["agentic ai engineer", "ai engineer", "ai developer", "llm engineer", "generative ai engineer", "ai full-stack engineer"])
        if "mern" in r or "web" in r:
            expanded_target_roles.update(["mern stack developer", "mern developer", "web developer", "web engineer"])
        if "java" in r:
            expanded_target_roles.update(["java developer", "java backend engineer", "spring boot developer", "java software engineer"])

    # 3. Parse skills from Profile and Resumes
    profile_skills = _extract_profile_skills(profile_text)
    resume_skills = _extract_resume_skills()
    raw_skills = profile_skills.union(resume_skills)

    skill_aliases = rules_config.get("skill_aliases", {})
    expanded_skills: Set[str] = set(raw_skills)
    for raw in raw_skills:
        expanded_skills.add(raw)
        for canon, aliases in skill_aliases.items():
            if raw in aliases or canon == raw:
                expanded_skills.update(aliases)
                expanded_skills.add(canon)

    default_profile_skills = {
        "react", "react.js", "reactjs", "react 18", "react 19", "next.js", "typescript", "ts", "javascript", "js",
        "node", "node.js", "nodejs", "express", "express.js", "expressjs",
        "java", "spring", "spring boot", "springboot", "hibernate", "jpa", "python", "fastapi", "postgresql", "postgres",
        "mysql", "mssql", "redis", "redis streams", "mongodb", "sql", "docker", "git", "jenkins",
        "aws", "gcp", "rest", "rest api", "restful", "restful apis", "microservices", "websockets", "sse",
        "langchain", "langgraph", "llm", "llms", "rag", "agentic ai", "system design", "dsa", "oop",
        "redux", "zustand", "tailwind", "tailwind css", "vite", "webpack", "micro-frontends", "puppeteer"
    }
    expanded_skills.update(default_profile_skills)

    # 4. Build evidence summary
    evidence_summary = build_evidence_summary(profile_text)

    return {
        "profile_text": profile_text,
        "candidate_experience": candidate_exp,
        "target_roles": expanded_target_roles,
        "allowed_skills": expanded_skills,
        "rules_config": rules_config,
        "evidence_summary": evidence_summary
    }
