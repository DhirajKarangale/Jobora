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

1. "role" (String): Extract the exact official job role/title explicitly stated in the posting (e.g., "Cloud Developer", "QA Engineer", "Software Engineer", "Full Stack Developer", "ServiceNow Developer"). If absent, output "Not provided".
2. "skills" (Array of Strings): Extract ALL technical skills (languages, frameworks, tools, databases, cloud platforms) explicitly present. Sort them so primary/core technologies (e.g. mentioned in the title or "Requirements" section) are AT THE TOP. Do not include soft skills.
3. "experience" (String): Extract the exact phrase or range regarding required years of experience (e.g. "0-2 years", "3-5 years", "8+ years", "2+ yrs"). If completely absent, output "Not provided".
4. "education" (String): Extract degree requirements (e.g. "Bachelor's in CS"). If absent, output "Not provided".
5. "salary" (String): Extract the exact salary range and currency explicitly stated. If stated in a foreign currency (e.g., USD, EUR), append a bracketed estimated conversion to INR LPA based on standard market rates (e.g., "$100k - $120k (Approx. 80-96 LPA)"). If completely absent, output "Not provided".
6. "location" (String): Extract the job location(s) if explicitly stated. If absent, output "Not provided".
7. "employment_type" (String): Extract explicit terms like "Full-time", "Contract", or "Intern". If not explicitly stated but the JD lists standard permanent employee benefits, output "Full-time (Implied)". Otherwise, output "Not provided".
8. "extra" (Array of Strings): Extract critical operational details ONLY IF present (e.g., "Remote option", "On-call rotation", "Shift timings"). Default to an empty array [] if none exist.

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

    return f"""Evaluate if candidate DHIRAJ KARANGALE is ELIGIBLE for the job position by dynamically comparing his CANDIDATE PROFILE with the STRUCTURED JOB DESCRIPTION.

CANDIDATE PROFILE:
{profile_text}

STRUCTURED JOB DESCRIPTION:
{jd_str}

STRICT ELIGIBILITY EVALUATION RULES (HIGH PRECISION REQUIRED):

1. TARGET ROLE FIT (Software Development vs Disqualified Disciplines):
   - Dhiraj's Target Roles: Agentic AI Engineer, Software Engineer, Software Development Engineer (SDE), Full-Stack Developer, Frontend Developer, Backend Developer, MERN Stack Developer.
   - DISQUALIFIED ROLE DOMAINS (MUST RETURN INELIGIBLE - NO):
     * Cloud / DevOps / Infrastructure: Cloud Developer, Cloud Engineer, Cloud Architect, Infrastructure Engineer, DevOps Engineer, SRE, Site Reliability Engineer, SysAdmin.
       CRITICAL: Roles focused on Cloud development/infrastructure or DevOps are NOT target roles for Dhiraj. Even if the JD lists programming languages like Python, Java, Golang, or JavaScript, Cloud/DevOps roles MUST RETURN INELIGIBLE (NO).
     * QA / Software Testing / SDET: QA Engineer, Software QA, Test Automation Engineer, Manual Tester, QA Specialist, SDET, Selenium Tester, Playwright Tester.
       CRITICAL: Writing test automation scripts in Python or TypeScript for a QA/Testing role does NOT make it a Software Engineering job. Return INELIGIBLE (NO).
     * Enterprise ERP / CRM: ServiceNow Developer/Consultant, Salesforce Developer/Admin, SAP Consultant, ABAP, Workday, Pega, COBOL, Mainframe.
     * Game / Embedded / Native Mobile: Unity, Unreal Engine, C#, .NET, ASP.NET, C++, Embedded/Firmware, Swift, iOS Native, Android Native, Flutter.
     * Non-Developer Roles: Product Manager, Project Manager, Scrum Master, Business Analyst, Customer Success, Technical Support.

2. SENIORITY TITLE & EXPERIENCE CEILING (Strict 2-Year Full-Time Candidate):
   - Dhiraj has 2 years of full-time experience (Max allowed minimum requirement ceiling is 3 years).
   - If minimum required experience Y > 3 years (e.g. 4+, 5+, 6+, 7+, 8+, 10+ years): RETURN INELIGIBLE (NO).
   - SENIORITY TITLE CHECK: If the role title or JD specifies Principal, Staff, Lead (Lead Developer, Lead Engineer, Tech Lead, Team Lead), Architect, Manager, Director, or VP, RETURN INELIGIBLE (NO) REGARDLESS of whether numerical experience is unstated or listed as 0-2 years.

3. TECH STACK ALIGNMENT:
   - Candidate's Core Stack: React.js, TypeScript, JavaScript, Node.js, Express.js, Java, Spring Boot, Python (Web/Backend/AI), PostgreSQL, MySQL, Redis, MongoDB, Docker, Git, REST APIs, WebSockets, LLMs/LangChain.
   - Disqualified Tech Stacks (RETURN INELIGIBLE - NO): Candidate does NOT specialize in C#, .NET, C++, Ruby, Rails, PHP, Laravel, Go/Golang (if primary language), Apex, ABAP, ServiceNow, Salesforce, Unity, Unreal, Swift, Kotlin, Flutter, Selenium, Playwright, Cypress. If ANY of these non-candidate technologies is a primary/core requirement of the job, RETURN INELIGIBLE (NO).
   - Full-Stack Requirement: If the role is Full-Stack, candidate MUST match BOTH frontend (React/TS/JS) and backend (Node/Express/Java/Python).

4. DEFAULT CONSERVATIVE RULE:
   - If there is ANY mismatch or ambiguity in role domain, seniority title, experience ceiling, or core tech stack, default strictly to INELIGIBLE (NO).

RETURN FORMAT:
You must output ONLY a valid JSON object matching this exact schema. Do not include markdown formatting like ```json.
{{
  "Reasoning": "Provide a concise 2-3 sentence step-by-step breakdown checking target role fit (Developer vs Cloud/QA/DevOps/ERP), seniority title (Staff/Principal/Lead), experience ceiling, and core tech stack match.",
  "Eligible": "YES or NO"
}}
"""

