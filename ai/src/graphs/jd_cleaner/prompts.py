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
5. "salary": Given salary range (min and max, e.g. "$120,000 - $150,000", or "Not provided").
6. "location": Job location if explicitly stated (e.g. "Remote", "Pune", or "Not provided").
7. "employment_type": Employment type if explicitly stated (e.g., "Full-time", "Part-time", "Contractor", "Intern", "Freelancer", or "Not provided").
8. "extra": Array of critical extra technical data ONLY IF present in the JD and not covered above that strictly matters to a software engineer (e.g., ["Remote option available", "On-call rotation required"]). This field is NOT compulsory; if no extra technical details exist, set it to "Not provided" or []. Do NOT include HR fluff or company perks.

Return ONLY a valid JSON object. Do NOT wrap in markdown or add conversational text outside the JSON.

{context_str}
"""



