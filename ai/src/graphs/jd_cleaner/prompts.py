def get_cleaning_prompt(text: str) -> str:
    return f"""
Clean the following raw text by removing formatting issues, extra whitespace, broken lines, and non-informative conversational noise.

STRICT RULES:
- Do NOT add any new information, facts, or assumptions.
- Preserve 100% of the original meaning and technical details.
- Return only the cleaned text.

Text to clean:
{text}
"""

def get_semantic_normalization_prompt(text: str) -> str:
    return f"""
Semantically normalize the following text to make it clear, consistent, and unambiguous.

STRICT RULES:
- Rely strictly on the provided text. Do NOT add, invent, or assume any facts, tools, technologies, or requirements.
- The original meaning and intent must remain unchanged.
- Preserve uncertainty and discussion context (e.g., "We might add search later" -> "Search was discussed as a potential enhancement").
- Return only the normalized text.

Text to normalize:
{text}
"""

def get_vocabulary_standardization_prompt(text: str) -> str:
    return f"""
Standardize the vocabulary in the following text.
- Replace informal or inconsistent synonyms with standard terms (e.g., "app" -> "application").
- Standardize entity representations without changing the underlying meaning.

STRICT RULES:
- Do NOT add any tools, languages, or concepts not present in the text.
- Return only the standardized text.

Text to standardize:
{text}
"""

def get_consistency_prompt(text: str) -> str:
    return f"""
Ensure requirement consistency and reduce ambiguity in the following text.
- Remove vague or redundant statements.
- Clearly separate known facts from unknowns.

STRICT RULES:
- Do NOT guess, extrapolate, or invent missing details.
- Rely strictly on the provided input text.
- Return only the consistent text.

Text to process:
{text}
"""

def get_language_normalization_prompt(text: str) -> str:
    return f"""
Normalize the language of the following text into professional, well-structured text.

STRICT RULES:
- Improve grammar and readability only.
- Do NOT introduce any new technologies, tools, or requirements that are not in the input.
- Maintain exact scope and intent.
- Return only the normalized text.

Text to normalize:
{text}
"""

def get_structuring_prompt(text: str, raw_text: str = "") -> str:
    context_str = f"Cleaned Text:\n{text}"
    if raw_text:
        context_str += f"\n\nOriginal Job Description:\n{raw_text[:4000]}"

    return f"""
Analyze the job description below and extract a developer-centric structured JSON object.

CRITICAL ANTI-HALLUCINATION INSTRUCTIONS:
- Extract ONLY technologies, languages, tools, skills, concepts, and qualifications that are EXPLICITLY mentioned in the input text.
- DO NOT assume, guess, or invent any programming language (e.g. Java, Python, C++), framework (e.g. React, Spring), database, or tool unless it is explicitly written in the input text!
- If no specific programming language or framework is explicitly named in the text, DO NOT include any! Do NOT make up examples.
- If a field is not explicitly mentioned, set it to "Not provided" or an empty list [].

EXTRACT THE FOLLOWING FIELDS:
1. "title": The official job title as stated in the text.
2. "focus": A concise summary of the primary technical focus and core engineering area of this role, derived ONLY from facts in the text (e.g., "Focuses on Application Design, Development Leadership, Information Modeling, and System Performance Optimization").
3. "skills": A single array combining ALL explicit technical skills, engineering concepts, methodologies, tools, and principles mentioned in the text (e.g., ["Application Programming Principles", "Information Modeling", "Data Structures", "Algorithms", "Agile Methodology", "Test Plan Execution", "Software Quality"]).
4. "responsibilities": A reduced list of 3-5 key technical responsibilities from the text that are NOT already obvious or redundant.
5. "experience": The explicit years of experience mentioned (e.g. "5-8 years", or "Not provided").
6. "education": The explicit degree/qualification mentioned (e.g. "Bachelor's/University degree or equivalent experience", or "Not provided").
7. "salary": Salary range if explicitly stated (else "Not provided").
8. "location": Job location if explicitly stated (else "Not provided").
9. "time_type": Employment type if explicitly stated (e.g., "Full-time", or "Not provided").

Return ONLY a valid JSON object. Do NOT add extra conversational text outside the JSON.

{context_str}
"""
