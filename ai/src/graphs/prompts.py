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

1. "role" (String): Extract the exact official job role/title explicitly stated in the posting (e.g., "Software Engineer", "Full Stack Developer", "AI Engineer", "Frontend Developer", "Java Developer", "Backend Engineer"). If absent, output "Not provided".
2. "core_skills" (Array of Strings): Extract the CORE/MANDATORY technical skills that are FUNDAMENTAL to performing this job. These are the technologies that define what the role actually is — the skills without which a candidate CANNOT do this job. Examples: For a Full-Stack Web Developer, core skills are "React", "Node.js", "TypeScript". For a Java Backend role, core skills are "Java", "Spring Boot", "Microservices". For an AI Engineer role, core skills are "Python", "LangChain/LangGraph", "LLMs", "RAG". Core skills are typically: mentioned in the job title, listed as "required"/"must-have", or central to the described responsibilities.
3. "secondary_skills" (Array of Strings): Extract the SECONDARY/SUPPORTING/NICE-TO-HAVE technical skills. These are generic, transferable, or supplementary technologies that support the core role but do NOT define it. Examples: "Git", "Docker", "AWS", "SQL", "REST APIs", "CI/CD", "Agile", "Linux".
4. "experience" (String): Extract the exact phrase or range regarding required years of experience (e.g. "0-2 years", "1-3 years", "2-4 years", "3-5 years", "2+ yrs"). If completely absent, output "Not provided".
5. "education" (String): Extract degree requirements (e.g. "Bachelor's in CS"). If absent, output "Not provided".
6. "salary" (String): Extract the exact salary range and currency explicitly stated. If stated in a foreign currency (e.g., USD, EUR), append a bracketed estimated conversion to INR LPA based on standard market rates (e.g., "$100k - $120k (Approx. 80-96 LPA)"). If completely absent, output "Not provided".
7. "location" (String): Extract the job location(s) if explicitly stated. If absent, output "Not provided".
8. "employment_type" (String): Extract explicit terms like "Full-time", "Contract", or "Intern". If not explicitly stated but the JD lists standard permanent employee benefits, output "Full-time (Implied)". Otherwise, output "Not provided".
9. "responsibilities" (Array of Strings): Extract the key responsibilities and day-to-day duties described in the job posting. Focus on what the person will actually DO in this role. Extract the 5-8 most important responsibilities. If absent, output an empty array [].
10. "domain" (String): Classify the PRIMARY professional discipline/domain of this role based on the title, responsibilities, and required skills. Choose the MOST SPECIFIC matching domain from this list: "Full-Stack Development", "Frontend Development", "Backend Development", "AI / LLM Engineering", "General Software Engineering", "Web Development", "Java Backend Engineering", "Mobile Development (iOS)", "Mobile Development (Android)", "Data Engineering", "DevOps / Infrastructure", "Cloud Engineering", "QA / Testing", "Security Engineering", "Game Development", "Embedded Systems", "Enterprise ERP/CRM", "Systems Programming". If none fit precisely, describe the domain in 2-4 words.
11. "extra" (Array of Strings): Extract critical operational details ONLY IF present (e.g., "Remote option", "On-call rotation", "Shift timings"). Default to an empty array [] if none exist.

IMPORTANT — CORE vs SECONDARY SKILL CLASSIFICATION:
- A skill is CORE if removing it from the candidate's profile would make them unqualified for the role.
- A skill is SECONDARY if it is useful but not essential — many different engineers have it regardless of specialization (e.g. Git, Docker, REST APIs, CI/CD).
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

    return f"""You are an EXPERT technical recruiter evaluating a candidate for a job opening.
Your goal is to accurately determine eligibility: approve candidates who possess demonstrated competency for the role, while rejecting genuine mismatches. Do not reject roles the candidate is realistically qualified for.

CANDIDATE PROFILE:
{profile_text}

{f"CANDIDATE EVIDENCE (Demonstrated Projects & Work History):{chr(10)}{evidence_summary}" if evidence_summary else ""}

STRUCTURED JOB DESCRIPTION:
{jd_str}

EVALUATION INSTRUCTIONS:

The candidate has 2+ years of full-time professional experience across two primary technical tracks:
1. AI Full-Stack / Agentic AI Engineering:
   - Python, FastAPI, LangChain, LangGraph, Multi-Agent Systems, ReAct Agents, RAG (Hybrid, Dense/Sparse, Vector Search with Qdrant & FAISS), Text-to-SQL, Vision-Language Models (VLM), Voice AI (Whisper), Prompt & Context Engineering, Token Optimization, AI Guardrails.
   - Combined with modern React and Node.js full-stack capabilities.
2. Full-Stack Software Engineering (React + Node.js + Java):
   - Frontend: React 18/19, TypeScript, JavaScript, Redux Toolkit, React Query, Zustand, Micro-Frontends (Webpack Module Federation), Tailwind CSS, Real-time WebSockets & SSE.
   - Backend: Node.js (Express.js), Java (Spring Boot, Spring Security, Spring Data JPA, Hibernate, gRPC), RESTful API Design, Microservices Architecture.
   - Data & Cloud: PostgreSQL, MySQL, MSSQL, Redis (Streams, Pub/Sub), MongoDB, Docker, AWS (S3), GCP, Git, CI/CD, Distributed Systems, System Design, DSA (LeetCode Knight 2,012 rating).

STEP 1 — IDENTIFY THE ACTUAL ROLE
Look at the role title, domain, responsibilities, and core_skills together.
Determine the primary day-to-day discipline of the role.

STEP 2 — CHECK CORE SKILL COMPETENCY
Does the candidate have proven or strong transferable experience with the core technical skills?
- Candidate MATCHES if the required core skills align with either of their two tracks:
  * Full-Stack Web: React, Node.js, TypeScript, JavaScript, HTML/CSS, REST APIs, SQL/Postgres/MySQL.
  * Java Backend / Full-Stack: Java, Spring Boot, Microservices, Hibernate, REST APIs, SQL.
  * AI / Agentic AI: Python, FastAPI, LLMs, LangChain/LangGraph, RAG, Agents, Vector Databases, React/Node.
  * Frontend: React, TypeScript, Redux, Tailwind, Webpack, Responsive UI.
  * Backend: Node.js, Express, Java, Spring Boot, PostgreSQL, MySQL, Redis, Microservices.
  * General SDE / Software Engineer: Algorithms, System Design, OOP, Web services, APIs.
- Candidate DOES NOT MATCH if the core mandatory skills require fundamentally different specialization:
  * Native iOS (Swift, Objective-C, SwiftUI, Xcode)
  * Native Android (Kotlin, Android SDK, Jetpack Compose)
  * Systems Programming / Graphics (C++, CUDA, OpenGL, DirectX, Kernel dev)
  * Dedicated Data Engineering (PySpark, Hadoop, Databricks, ETL pipelines as sole function)
  * Dedicated Cloud Infra / DevOps (Terraform, Kubernetes cluster admin as sole function)
  * Embedded Systems / Hardware / IoT
  * Game Development (Unity, Unreal Engine)

NOTE ON SECONDARY TOOLS: Mentioning Docker, AWS, Git, CI/CD, Linux, Agile, or WebSockets does NOT make a software engineering role a "DevOps" role. Full-stack developers routinely use these tools.

STEP 3 — CHECK DOMAIN COMPATIBILITY
- Compatible Domains:
  "Full-Stack Development", "Frontend Development", "Backend Development", "AI / LLM Engineering", "General Software Engineering", "Web Development", "Java Backend Engineering".
- Incompatible Domains:
  "Mobile Development (iOS)", "Mobile Development (Android)", "Data Engineering", "DevOps / Infrastructure", "Game Development", "Embedded Systems", "Systems Programming", "QA / Testing".

STEP 4 — CHECK SENIORITY
- Candidate has ~2 years of full-time professional experience.
- Compatible: 0-2 years, 1-3 years, 2-4 years, 2-5 years, 3-5 years, Junior, Associate, SDE-1, SDE-2, Software Engineer, Full Stack Developer, AI Engineer.
- Incompatible: Explicit requirement of 5+ years, 6+ years, 8+ years, or senior designations such as Staff, Principal, Director, VP, Head of.

STEP 5 — FINAL VERDICT
Mark "eligible": "YES" if:
1. The role domain is compatible with the candidate's tracks.
2. The candidate possesses the majority of the core skills required.
3. The seniority requirement is compatible (up to 4-5 years ceiling).

Otherwise, mark "eligible": "NO".

OUTPUT FORMAT:
Output ONLY a valid JSON object. Do not wrap in markdown code blocks.

{{
  "role_domain": "The actual domain/discipline of this job",
  "role_domain_match": true or false,
  "core_skills_required": ["the core skills this job requires"],
  "candidate_has_core_skills": ["which core skills the candidate has"],
  "candidate_missing_core_skills": ["which core skills the candidate lacks"],
  "core_skill_match_ratio": 0.0 to 1.0,
  "seniority_level": "junior/mid/senior/staff/principal/lead",
  "seniority_compatible": true or false,
  "reasoning": "2-3 sentences explaining what the job is, how the candidate's skills match or mismatch, and the final fit decision",
  "eligible": "YES or NO"
}}
"""

def get_resume_selection_prompt(structured_jd: dict, all_resumes_text: str) -> str:
    jd_str = json.dumps(structured_jd, indent=2, ensure_ascii=False)
    
    return f"""You are an expert technical recruiter matching an eligible job description to the candidate's best-fit resume.

STRUCTURED JOB DESCRIPTION:
{jd_str}

AVAILABLE RESUMES:
{all_resumes_text}

RESUME MATCHING RULES:
The candidate maintains exactly TWO specialized resumes:

1. "AI" (AI Full-Stack Resume):
   - Focus: AI/ML, Generative AI, LLMs, Agentic AI, Multi-Agent Systems, RAG, LangChain, LangGraph, Text-to-SQL, Vector DBs, Prompt Engineering, Python, FastAPI, and AI-integrated Full-Stack applications (React + Node.js).
   - Use for: AI Engineer, Agentic AI Engineer, Generative AI Engineer, LLM Engineer, RAG Engineer, AI Full-Stack Developer, AI Application Developer, or software engineering roles where AI/LLM integration is the key requirement.

2. "FullStack" (Full-Stack Software Engineering Resume):
   - Focus: Core Full-Stack engineering, React 18/19, TypeScript, JavaScript, Micro-Frontends, Redux, Zustand, Node.js, Express.js, Java, Spring Boot, Spring Security, Spring Data JPA, Microservices, RESTful APIs, gRPC, PostgreSQL, MySQL, Redis, System Design, DSA.
   - Use for: Full-Stack Engineer, Frontend Engineer (React/TypeScript), Backend Engineer (Node.js/Express or Java/Spring Boot), Java Developer, MERN Developer, or General Software Engineer / SDE roles.

3. "NONE":
   - Use ONLY if the role is a complete mismatch for both resumes (e.g., requires C++, Go, iOS Swift, native Android, or deep infrastructure engineering).

OUTPUT FORMAT:
Output ONLY a valid JSON object. Do not wrap in markdown code blocks.

{{
  "reasoning": "Explain why this specific resume was chosen, or why none fit.",
  "fit_resume": "AI" or "FullStack" or "NONE"
}}
"""
