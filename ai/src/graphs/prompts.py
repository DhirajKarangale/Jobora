import json

def get_cleaning_prompt(text: str) -> str:
    return f"""You are a strict text-processing engine. Your task is to clean and normalize the provided raw job description text. 

Raw Job Description:
{text}

CLEANING INSTRUCTIONS:
1. Strip all HTML tags, emojis, special character icons, and visual separators (e.g., '---', '***').
2. Fix encoding artifacts: Normalize unicode escapes (e.g., '\\u2019' to standard apostrophe "'") and handle raw '\\n' tags by converting them to actual line breaks.
3. Remove boilerplate noise: Delete EEO (Equal Employment Opportunity) disclaimers, diversity statements, "Apply Now" links, standard legal footers, and conversational introductions.

STRICT PRESERVATION RULES:
- DO NOT SUMMARIZE, PARAPHRASE, OR RESTRUCTURE. You must keep the exact original wording, sentence structure, and bullet points for all Responsibilities, Requirements, Qualifications, Tech Stack, and Role Descriptions.
- Preserve ALL technical details, skills, tools, and years of experience EXACTLY as they appear in the source text.
- Do NOT invent, infer, or extrapolate any information. 

OUTPUT FORMAT:
Output ONLY the cleaned plain text. 
Do NOT wrap the output in markdown code blocks (e.g., do not use ```text or ```). 
Do NOT include any conversational filler before or after the text (e.g., do not say "Here is the cleaned text:").
"""

def get_structuring_prompt(text: str, raw_text: str = "") -> str:
    combined_text = f"{text}\n\nORIGINAL RAW HEADER CONTEXT:\n{raw_text[:1000]}" if raw_text else text
    return f"""Analyze the job description below and extract a structured JSON object.

Job Description:
{combined_text}

ANTI-HALLUCINATION & EXTRACTION RULES:
- Actively SEARCH the entire text (including all headings, bullet points, and requirements) to find the required data.
- Extract ONLY data EXPLICITLY mentioned in the input text.
- DO NOT assume, guess, or invent any programming language, framework, database, or requirement.

FIELD SPECIFICATIONS & SCHEMA:
Ensure your output strictly adheres to this JSON schema and data types:

1. "role" (String): Extract the exact official job role/title explicitly stated in the posting (e.g., "Cloud Developer", "QA Engineer", "Software Engineer", "Full Stack Developer", "Data Engineer", "Android Developer", "C++ Engineer"). If absent, output "Not provided".
2. "core_skills" (Array of Strings): Extract the CORE/MANDATORY technical skills that are FUNDAMENTAL to performing this job. These are the technologies that define what the role actually is — the skills without which a candidate CANNOT do this job. Examples: For an Android Developer role, core skills are "Android", "Kotlin", "Java (Android)". For a Data Engineer role, core skills are "PySpark", "ETL", "Snowflake", "Airflow". For a C++ Engineer, the core skill is "C++". For a Full-Stack Web Developer, core skills are "React", "Node.js", "TypeScript". Core skills are typically: mentioned in the job title, listed as "required"/"must-have", or central to the described responsibilities.
3. "secondary_skills" (Array of Strings): Extract the SECONDARY/SUPPORTING/NICE-TO-HAVE technical skills. These are generic, transferable, or supplementary technologies that support the core role but do NOT define it. Examples: "Git", "Docker", "AWS", "SQL", "REST APIs", "CI/CD", "Agile". These are skills that many engineering roles share regardless of specialization.
4. "experience" (String): Extract the exact phrase or range regarding required years of experience (e.g. "0-2 years", "3-5 years", "8+ years", "2+ yrs"). If completely absent, output "Not provided".
5. "education" (String): Extract degree requirements (e.g. "Bachelor's in CS"). If absent, output "Not provided".
6. "salary" (String): Extract the exact salary range and currency explicitly stated. If stated in a foreign currency (e.g., USD, EUR), append a bracketed estimated conversion to INR LPA based on standard market rates (e.g., "$100k - $120k (Approx. 80-96 LPA)"). If completely absent, output "Not provided".
7. "location" (String): Extract the job location(s) if explicitly stated. If absent, output "Not provided".
8. "employment_type" (String): Extract explicit terms like "Full-time", "Contract", or "Intern". If not explicitly stated but the JD lists standard permanent employee benefits, output "Full-time (Implied)". Otherwise, output "Not provided".
9. "responsibilities" (Array of Strings): Extract the key responsibilities and day-to-day duties described in the job posting. Focus on what the person will actually DO in this role. Extract the 5-8 most important responsibilities. If absent, output an empty array [].
10. "domain" (String): Classify the PRIMARY professional discipline/domain of this role based on the title, responsibilities, and required skills. Choose the MOST SPECIFIC matching domain from this list: "Web Development", "Frontend Development", "Backend Development", "Full-Stack Development", "Mobile Development (iOS)", "Mobile Development (Android)", "Mobile Development (Cross-Platform)", "Data Engineering", "Data Science / ML", "DevOps / Infrastructure", "Cloud Engineering", "QA / Testing", "Security Engineering", "Game Development", "Embedded Systems", "Enterprise ERP/CRM", "AI / LLM Engineering", "Site Reliability Engineering", "Database Administration", "Systems Programming", "GPU / Graphics Programming", "General Software Engineering". If none fit precisely, describe the domain in 2-4 words.
11. "extra" (Array of Strings): Extract critical operational details ONLY IF present (e.g., "Remote option", "On-call rotation", "Shift timings"). Default to an empty array [] if none exist.

IMPORTANT — CORE vs SECONDARY SKILL CLASSIFICATION:
- A skill is CORE if removing it from the candidate's profile would make them unqualified for the role.
- A skill is SECONDARY if it is useful but not essential — many different engineers have it regardless of specialization.
- When in doubt, classify a skill as CORE. It is better to over-classify than under-classify.
- Python, SQL, Git, Docker, AWS, REST APIs are almost always SECONDARY unless the role is specifically about those (e.g., "Python Developer" makes Python core).

OUTPUT FORMAT:
You must output ONLY a valid JSON object matching the keys above. 
Do NOT wrap the output in markdown code blocks (e.g., do not use ```json or ```). 
Do NOT include any conversational filler before or after the JSON.

{{
  "role": "",
  "core_skills": [],
  "secondary_skills": [],
  "experience": "",
  "education": "",
  "salary": "",
  "location": "",
  "employment_type": "",
  "responsibilities": [],
  "domain": "",
  "extra": []
}}
"""

def get_eligibility_prompt(structured_jd: dict, profile_text: str, evidence_summary: str = "") -> str:
    jd_str = json.dumps(structured_jd, indent=2, ensure_ascii=False)

    return f"""You are a STRICT job eligibility evaluator. Your job is to REJECT candidates who lack core competencies. Default to NO unless there is strong evidence of fit.

CANDIDATE PROFILE:
{profile_text}

{f"CANDIDATE EVIDENCE (What the candidate has actually worked on):{chr(10)}{evidence_summary}" if evidence_summary else ""}

STRUCTURED JOB DESCRIPTION:
{jd_str}

EVALUATION INSTRUCTIONS:

You must determine if this candidate can REALISTICALLY perform this job based on their DEMONSTRATED experience. Follow these steps strictly:

STEP 1 — IDENTIFY THE ACTUAL JOB
Look at the role title, domain, responsibilities, AND core_skills together. What does this person actually DO day-to-day?
Do NOT rely on the job title alone. An "SDE" role requiring C++, CUDA, and GPU programming is a GPU/Systems Engineer, not a general Software Engineer.

STEP 2 — CHECK CORE SKILL COMPETENCY (MOST IMPORTANT STEP)
Look at the "core_skills" from the structured JD. These are the skills WITHOUT WHICH a person CANNOT do this job.
For EACH core skill, check: does the candidate have PROVEN experience with it?
- Professional work experience = strong evidence
- Built a project with it = moderate evidence  
- Listed in skills section only = weak evidence (NOT sufficient for core skills)
- Not mentioned at all = no evidence

CRITICAL RULE: If the candidate LACKS experience with the MAJORITY of core skills, they are NOT ELIGIBLE. Period.
Generic skill overlap (Python, SQL, Git, Docker, AWS, REST APIs) does NOT compensate for missing core skills.

Examples of INCORRECT eligibility decisions (these should ALL be NO):
- Android Developer role: candidate knows Java but NOT Android/Kotlin → NO (Java alone is not Android competency)
- C++ Engineer role: candidate knows Python, JS but NOT C++ → NO
- Golang Developer role: candidate knows Node.js but NOT Go → NO  
- Data Engineer role: candidate knows Python, SQL but NOT PySpark/ETL/Airflow/data pipelines → NO
- GPU Engineer role: candidate knows Python but NOT CUDA/OpenGL/GPU programming → NO
- iOS Developer role: candidate knows React but NOT Swift/Objective-C → NO
- DevOps Engineer role: candidate knows Docker but NOT Terraform/Ansible/CI-CD-as-primary-role → NO

STEP 3 — CHECK DOMAIN COMPATIBILITY
The candidate is a Web/Full-Stack Software Engineer. Their professional experience is in:
- React/TypeScript frontends, Node.js/Express/Java/Spring Boot backends
- REST APIs, WebSockets, micro-frontend architectures
- AI-powered web applications using LLMs/LangChain
- PostgreSQL, MySQL, Redis, MongoDB in web application context

Compatible domains: Web Development, Frontend, Backend, Full-Stack, AI/LLM Engineering, General Software Engineering (when core stack matches)
Incompatible domains: Data Engineering, DevOps, Cloud Engineering, Mobile (iOS/Android), QA/Testing, Game Development, Embedded Systems, GPU/Graphics, Enterprise ERP/CRM, Systems Programming, Security Engineering

STEP 4 — CHECK SENIORITY
Candidate has ~2 years of full-time experience.
- 0-3 years required: compatible
- 2-4 years required: compatible
- 4+ years or Senior title with senior-level responsibilities: incompatible
- Staff/Principal/Lead/Architect responsibilities (leading teams, setting org-wide direction): incompatible

STEP 5 — FINAL VERDICT
The candidate is ELIGIBLE only if ALL of the following are true:
1. The job domain matches the candidate's experience domain
2. The candidate has proven experience with the MAJORITY of core skills
3. The seniority level is compatible
4. A hiring manager would realistically consider this candidate

If ANY of these fail, the answer is NO.

OUTPUT FORMAT:
Output ONLY a valid JSON object. Do not wrap in markdown code blocks.

{{
  "role_domain": "The actual domain/discipline of this job",
  "role_domain_match": true or false,
  "core_skills_required": ["the core skills this job requires"],
  "candidate_has_core_skills": ["which core skills the candidate actually has"],
  "candidate_missing_core_skills": ["which core skills the candidate LACKS"],
  "core_skill_match_ratio": 0.0 to 1.0,
  "seniority_level": "junior/mid/senior/staff/principal/lead",
  "seniority_compatible": true or false,
  "reasoning": "2-3 sentences explaining: what the job actually is, what core skills are missing, and why the candidate is or is not a fit",
  "eligible": "YES or NO"
}}
"""
