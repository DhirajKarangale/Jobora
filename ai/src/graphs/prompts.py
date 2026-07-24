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
- Actively SEARCH the text to find the required data. Scan thoroughly before concluding a field is "Not provided".
- Extract ONLY data EXPLICITLY mentioned in the input text (except for the explicit fallback rules defined below).
- DO NOT assume, guess, or invent any programming language, framework, database, or requirement.

FIELD SPECIFICATIONS & SCHEMA:
Ensure your output strictly adheres to this JSON schema and data types:

1. "skills" (Array of Strings): Extract ONLY technical skills (languages, frameworks, tools, databases) explicitly present. Sort them so that primary/core technologies (e.g., mentioned in the title or "Requirements" section) are AT THE TOP. Do not include soft skills or non-technical jargon.
2. "experience" (String): Extract the exact phrase regarding years of experience (e.g., "3-5 years", "8+ years"). If completely absent, output "Not provided".
3. "education" (String): Extract degree requirements (e.g., "Bachelor's in CS"). If absent, output "Not provided".
4. "salary" (String): Extract the exact salary range and currency explicitly stated. If stated in a foreign currency (e.g., USD, EUR), append a bracketed estimated conversion to INR LPA based on standard market rates (e.g., "$100k - $120k (Approx. 80-96 LPA)"). If completely absent, output "Not provided".
5. "location" (String): Extract the job location(s) if explicitly stated. If absent, output "Not provided".
6. "employment_type" (String): Extract explicit terms like "Full-time", "Contract", or "Intern". If not explicitly stated but the JD lists standard permanent employee benefits (e.g., PTO, health insurance), output "Full-time (Implied)". Otherwise, output "Not provided".
7. "extra" (Array of Strings): Extract critical, non-fluff technical or operational details ONLY IF present (e.g., "Remote option", "On-call rotation", "Shift timings"). Default to an empty array [] if none exist.

OUTPUT FORMAT:
You must output ONLY a valid JSON object matching the keys above. 
Do NOT wrap the output in markdown code blocks (e.g., do not use ```json or ```). 
Do NOT include any conversational filler before or after the JSON.

{{
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

DO NOT ASSUME OR HARDCODE ANY CANDIDATE DATA. Extract candidate experience, skills, target roles, preferred locations, and expectations directly from the CANDIDATE PROFILE below.

CANDIDATE PROFILE:
{profile_text}

STRUCTURED JOB DESCRIPTION:
{jd_str}

ELIGIBILITY EVALUATION RULES:

1. EXPERIENCE (Strict Calculation):
   - Extract the candidate's total years of experience from the Candidate Profile (let this be X).
   - Extract the MINIMUM required years of experience from the JD (let this be Y). If the JD lists a range (e.g., "3-5 years"), Y is 3.
   - If Y <= (X + 1): PASS.
   - If Y > (X + 1): FAIL.
   - If job experience is "Not provided" or ambiguous: PASS.

2. SKILLS (Top Skills & Strict Full-Stack Match):
   - Prioritization: Treat the first listed skills in both the JD and the Profile as the most critical. The top primary skills required in the JD MUST explicitly exist in the candidate's profile.
   - Strict Full-Stack Rule: If the role is Full-Stack, the candidate MUST have matching experience in BOTH the specific frontend and the specific backend required. 
   - Full-Stack Example: If the JD requires a React frontend and a C# .NET backend, but the candidate only possesses React alongside Node.js or Java, this is a FAIL. Partial stack matches (matching frontend but failing backend) equal a FAIL.

3. ROLE:
   - Compare the job role against the candidate's Target Roles or primary skill domain.
   - If the role requires a completely different domain specialization not matching the candidate's profile: FAIL.
   - Otherwise: PASS.

4. LOCATION, EDUCATION & SALARY:
   - Compare job location, education, salary, and employment type against the Candidate Profile.
   - If any JD requirements directly violate the candidate's explicit preferences or boundaries: FAIL.
   - Otherwise: PASS.

RETURN FORMAT:
You must output ONLY a valid JSON object matching this exact schema. Do not include markdown formatting like ```json.
{{
  "Reasoning": "Provide a concise, 2-3 sentence step-by-step breakdown. State the candidate's experience (X) vs JD experience (Y). Then explicitly check the primary frontend and backend skills for exact matches.",
  "Eligible": "YES or NO"
}}
"""
