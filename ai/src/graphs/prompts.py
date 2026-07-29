import json

def get_cleaning_prompt(text: str) -> str:
    return f"""You are a strict text-processing engine. Your task is to clean and normalize the provided raw job description text. 

Raw Job Description:
{text}

CLEANING INSTRUCTIONS:
1. Strip all HTML tags, emojis, special character icons, and visual separators (e.g., '---', '***').
2. Fix encoding artifacts: Normalize unicode escapes (e.g., '\u2019' to standard apostrophe "'") and handle raw '\n' tags by converting them to actual line breaks.
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
    return f"""Analyze the raw job description below and extract a structured JSON object.

Raw Job Description:
{text}

ANTI-HALLUCINATION & EXTRACTION RULES:
- Actively SEARCH the entire text (including all bullet points and requirements) to find the required data. Scan thoroughly before concluding a field is "Not provided".
- Extract ONLY data EXPLICITLY mentioned in the input text.
- DO NOT assume, guess, or invent any programming language, framework, database, or requirement.

FIELD SPECIFICATIONS & SCHEMA:
Ensure your output strictly adheres to this JSON schema and data types:

1. "role" (String): Extract the official job role/title explicitly stated. If absent, output "Not provided".
2. "skills" (Array of Strings): Extract ALL technical skills (languages, frameworks, tools, databases, cloud platforms) explicitly present. Sort them so primary/core technologies (e.g. mentioned in the title or "Requirements" section) are AT THE TOP. Do not include soft skills or non-technical jargon.
3. "experience" (String): Extract the exact phrase or range regarding required years of experience (e.g. "3-5 years", "8+ years", "2+ yrs"). If completely absent, output "Not provided".
4. "education" (String): Extract degree requirements (e.g. "Bachelor's in CS"). If absent, output "Not provided".
5. "salary" (String): Extract the exact salary range and currency explicitly stated. If stated in a foreign currency (e.g., USD, EUR), append a bracketed estimated conversion to INR LPA based on standard market rates (e.g., "$100k - $120k (Approx. 80-96 LPA)"). If completely absent, output "Not provided".
6. "location" (String): Extract the job location(s) if explicitly stated. If absent, output "Not provided".
7. "employment_type" (String): Extract explicit terms like "Full-time", "Contract", or "Intern". If not explicitly stated but the JD lists standard permanent employee benefits (e.g., PTO, health insurance), output "Full-time (Implied)". Otherwise, output "Not provided".
8. "extra" (Array of Strings): Extract critical, non-fluff technical or operational details ONLY IF present (e.g., "Remote option", "On-call rotation", "Shift timings"). Default to an empty array [] if none exist.

OUTPUT FORMAT:
You must output ONLY a valid JSON object matching the keys above. 
Do NOT wrap the output in markdown code blocks (e.g., do not use ```json or ```). 
Do NOT include any conversational filler before or after the JSON.

{{
  "role": "",
  "skills": [],
  "experience": "",
  "education": "",
  "salary": "",
  "location": "",
  "employment_type": "",
  "extra": []
}}
"""

def get_eligibility_prompt(structured_jd: dict, profile_text: str) -> str:
    jd_str = json.dumps(structured_jd, indent=2, ensure_ascii=False)

    return f"""Evaluate if the candidate is ELIGIBLE for the job position by dynamically comparing the CANDIDATE PROFILE with the STRUCTURED JOB DESCRIPTION.

CANDIDATE PROFILE:
{profile_text}

STRUCTURED JOB DESCRIPTION:
{jd_str}

STRICT ELIGIBILITY EVALUATION RULES:

1. EXPERIENCE (Strict Ceiling):
   - Extract candidate's total full-time software experience (X = 2 years).
   - Extract MINIMUM required experience from JD (Y).
   - If Y > 3 years (e.g., 4+, 5+, 6+, 7+, 8+, 10+ years), or if role is Staff/Principal/Director level: RETURN INELIGIBLE (NO).
   - Maximum allowed minimum required experience is 3 years.

2. SKILLS & STRICT DEALBREAKERS:
   - Candidate Core Skills: React.js, TypeScript, JavaScript, Node.js, Express.js, Java, Spring Boot, Python, PostgreSQL, MySQL, Redis, MongoDB, Docker, Git.
   - DEALBREAKER SKILLS (Candidate DOES NOT possess these; if ANY are required as a primary/core skill in the JD, RETURN INELIGIBLE - NO):
     * Game / Embedded / Native: Unity, Unity3D, Unreal, C#, .NET, ASP.NET, C++, C, Swift, iOS, Kotlin, Android Native, Flutter.
     * ERP / CRM / Proprietary: Salesforce, Apex, SAP, ABAP, ServiceNow, Workday, Pega, COBOL.
     * Non-matching Web Stacks: Ruby, Ruby on Rails, PHP, Laravel, Rust, Go/Golang (if primary), Scala.
     * Non-Developer Roles: QA/Manual/Automation Testing, DevOps/SRE, Data Engineering (ETL/Snowflake/Hadoop), Security, Scrum Master, Product/Project Manager.
   - Strict Full-Stack Rule: If the role is Full-Stack, candidate MUST match BOTH frontend (React/TS/JS) and backend (Node/Express/Java/Python). Partial stack match (e.g. React frontend with C# backend) is INELIGIBLE (NO).

3. ROLE FIT:
   - Target Roles: Software Engineer, SDE, Full-Stack Developer, Frontend Developer, Backend Developer, MERN Stack Developer, Agentic AI Engineer.
   - Any non-matching role or domain (e.g., Unity Engineer, iOS Developer, Salesforce Developer) MUST BE MARKED INELIGIBLE (NO).

RETURN FORMAT:
You must output ONLY a valid JSON object matching this exact schema. Do not include markdown formatting like ```json.
{{
  "Reasoning": "Provide a concise 2-3 sentence step-by-step breakdown checking experience ceiling, dealbreaker skills, and full-stack match.",
  "Eligible": "YES or NO"
}}
"""

