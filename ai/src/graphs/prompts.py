def get_cleaning_prompt(text: str) -> str:
    return f"""Clean, normalize, and summarize the raw job description text below into a clear, professional, and structured technical summary.

CLEANING & NORMALIZATION INSTRUCTIONS:
1. Formatting & Code Removal: Strip HTML tags/code, emojis, icons, separators (e.g., '---', '***', '==='), unicode apostrophe escapes (e.g., '\\u2019' or smart quotes -> convert to standard ASCII "'"), broken lines, extra spaces, and inconsistent casing/formatting.
2. Noise & Repetition Removal: Remove repeated words/statements, fillers ("uh", "basically", "you know"), conversational noise, HR boilerplate, EEO disclaimers, company introduction fluff, and apply links.
3. Concise Summary: Summarize the core requirements concisely.

STRICT RULES:
- Preserve ALL technical details, job requirements, skills, qualifications, tools, experience, and core job details verbatim.
- Do NOT invent, assume, or extrapolate any new facts or technologies.
- Return ONLY the cleaned, summarized text.

Text to clean:
{text}
"""

def get_structuring_prompt(text: str, raw_text: str = "") -> str:
    context_str = f"Cleaned Text:\n{text}"
    if raw_text:
        context_str += f"\n\nOriginal Text:\n{raw_text[:4000]}"

    return f"""Analyze the job description below and extract a developer-centric structured JSON object.

CRITICAL INSTRUCTIONS:
- Extract ONLY technologies, languages, tools, skills, concepts, and qualifications EXPLICITLY mentioned in the input text.
- DO NOT assume, guess, or invent any programming language, framework, database, or tool unless explicitly written in the input text.
- Normalize unicode apostrophes (e.g. '\\u2019' or '’') to standard ASCII (e.g., "Bachelor's" instead of "Bachelor\\u2019s").

FIELD SPECIFICATIONS:
1. "title": Understand the JD well and determine the best-matching software developer job title (e.g., "Generic Software Engineer", "Backend Developer", "Frontend Developer", "Fullstack Developer", "AI Developer", "DevOps Engineer", "Mobile Developer", etc.).
2. "skills": Extract ONLY technical skills explicitly present in the JD (programming languages, frameworks, libraries, tools, databases, and technical concepts like System Design, DSA, OOP, Multi-threading). MUST BE SORTED with the primary core technologies the role focuses on AT THE TOP of the list, followed by secondary tools and concepts. No fluff or non-technical jargon.
3. "experience": Required experience range (min and max, e.g. "3-5 years", "7+ years", or "Not provided").
4. "education": Degree/qualification explicitly mentioned (e.g., "Bachelor's degree in Computer Science", or "Not provided").
5. "salary": Given salary range (min and max). If salary is provided and its currency is NOT INR (e.g. USD $, EUR €, GBP £), convert/express the salary range into INR (₹ or LPA) based on approximate current conversion rates (e.g., $1 USD ≈ ₹85 INR). If currency is already INR, keep it in INR. If no salary is provided, set to "Not provided".
6. "location": Job location if explicitly stated (e.g. "Remote", "Pune", or "Not provided").
7. "employment_type": Employment type if explicitly stated (e.g., "Full-time", "Part-time", "Contractor", "Intern", "Freelancer", or "Not provided").
8. "extra": Array of critical extra technical data ONLY IF present in the JD and not covered above that strictly matters to a software engineer (e.g., ["Remote option available", "On-call rotation required"]). This field is NOT compulsory; if no extra technical details exist, set it to "Not provided" or []. Do NOT include HR fluff or company perks.

Return ONLY a valid JSON object. Do NOT wrap in markdown or add conversational text outside the JSON.

{context_str}
"""


def get_eligibility_prompt(structured_jd: dict, profile_text: str, raw_text: str = "") -> str:
    import json
    jd_str = json.dumps(structured_jd, indent=2, ensure_ascii=False)

    return f"""Evaluate whether the candidate (profile provided below) is ELIGIBLE for the job position based on the structured Job Description (JD).

ACCURACY IS CRITICAL: DO NOT MISS ANY VALID JOB AND DO NOT MARK CLEARLY INELIGIBLE JOBS AS ELIGIBLE.

CANDIDATE PROFILE:
{profile_text}

STRUCTURED JOB DESCRIPTION:
{jd_str}

RAW JOB DESCRIPTION (Reference):
{raw_text[:2500]}

STRICT ELIGIBILITY RULES:

1. EXPERIENCE (Candidate has 2 years of full-time experience):
   - If JD required experience is 0, 1, or 2 years: PASS (Eligible).
   - If JD minimum required experience is 3 years (e.g. "3 years", "3-5 years", "3+ years", which is 1 year more than candidate's 2 years): PASS (Eligible - candidate can be considered).
   - If JD minimum required experience is 4 years or higher (e.g. "4+ years", "5-7 years", "7+ years"): FAIL (NOT ELIGIBLE).
   - If experience is "Not provided": PASS.

2. SKILLS (Top/Primary Priority Skills Matching):
   - Check top 1-2 primary skills required in the JD.
   - RULE: If the TOP required skill for the role is a technology the candidate does NOT specialize in (e.g., C#, .NET, Go, Rust, Kotlin, Swift, iOS, Android native, SAP, Salesforce, Ruby, Cobol, ABAP), the candidate is NOT ELIGIBLE even if a secondary skill (like React or SQL) is mentioned.
   - If top skills match the candidate's core stack (React, TypeScript, JavaScript, Node.js, Express, Java, Spring Boot, Python, AI/LLM/LangChain, SQL/NoSQL, REST, WebSockets, System Design): PASS.

3. ROLE / TITLE:
   - If generic Software Engineer / SDE / Fullstack / Backend / Frontend / MERN / AI Engineer / Developer: PASS.
   - If role matches target roles in profile: PASS.
   - If role requires completely different domain specialization (e.g. "C# Developer", "Kotlin Developer", "Consultant", "SAP Specialist", "Salesforce Developer", "iOS Engineer"): FAIL.

4. EDUCATION:
   - Candidate has a Bachelor's degree (B.E./B.Tech) in Computer Science.
   - If Bachelor's degree, B.E., B.Tech, BS CS, or "Not provided": PASS.
   - If strictly requires Ph.D or non-CS mandatory requirement: FAIL.

5. LOCATION:
   - If "Not provided": PASS (ignore).
   - If Remote (any), or On-site/Hybrid in India (Bangalore, Pune, Hyderabad, or any Indian city): PASS.
   - If strictly mandatory On-site in a foreign country (requiring local foreign work visa): FAIL.

6. SALARY:
   - If "Not provided": PASS (ignore).
   - Candidate expectation: 16-18 LPA INR.
   - If salary is reasonable or close to expectation: PASS.
   - If salary is severely under market expectation (e.g. under 4 LPA for 2+ yr exp developer): FAIL.

7. EMPLOYMENT TYPE:
   - Candidate prefers Full-Time.
   - If "Not provided" or "Full-time": PASS.
   - If short-term unpaid internship or part-time conflicting role: FAIL.

8. EXTRA REQUIREMENTS:
   - Check for hard dealbreakers (e.g., US security clearance, 10+ yrs exp required).

RETURN FORMAT:
Return ONLY a valid JSON object matching this exact schema and nothing else:
{{
  "Eligible": "YES"
}}
or if not eligible:
{{
  "Eligible": "NO"
}}
"""
