import os
import sys
import logging
from dotenv import load_dotenv

# Load environment variables from .env in the ai/ directory
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
load_dotenv(env_path)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def _parse_keys(env_var_name: str) -> list:
    """Parses comma or newline separated keys from environment variables."""
    val = os.getenv(env_var_name)
    if not val:
        return []
    cleaned = val.replace("\n", ",").replace('"', "").replace("'", "")
    return [k.strip() for k in cleaned.split(",") if k.strip()]

def get_llm_response(query: str, temperature: float = 0.0) -> str:
    """
    Tries to get a response from an LLM by cycling through providers and their keys.
    Priority: 1. Groq, 2. Gemini, 3. HuggingFace.
    If all keys for a provider fail, it moves to the next provider.
    """
    
    # 1. Groq
    groq_keys = _parse_keys("GROQ_API_KEY")
    if groq_keys:
        logger.info("Trying Groq provider...")
        try:
            from langchain_groq import ChatGroq
            # Fallback to a standard Groq model if needed, but here is a typical one
            model_name = "openai/gpt-oss-120b"
            
            for idx, key in enumerate(groq_keys, 1):
                logger.info(f"Trying Groq key {idx}/{len(groq_keys)}")
                try:
                    llm = ChatGroq(model_name=model_name, groq_api_key=key, temperature=temperature)
                    response = llm.invoke(query)
                    return response.content
                except Exception as e:
                    logger.info(f"Error with Groq key {idx}: {e}")
        except ImportError:
            logger.warning("langchain_groq is not installed, skipping Groq.")

    # 2. Gemini
    gemini_keys = _parse_keys("GEMINI_API_KEY")
    if gemini_keys:
        logger.info("Trying Gemini provider...")
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            model_name = "gemini-3.5-flash-lite"
            
            for idx, key in enumerate(gemini_keys, 1):
                logger.info(f"Trying Gemini key {idx}/{len(gemini_keys)}")
                try:
                    llm = ChatGoogleGenerativeAI(model=model_name, google_api_key=key, temperature=temperature)
                    response = llm.invoke(query)
                    if isinstance(response.content, list):
                        return "".join(
                            [
                                part.get("text", "")
                                for part in response.content
                                if isinstance(part, dict) and "text" in part
                            ]
                        )
                    return str(response.content)
                except Exception as e:
                    logger.info(f"Error with Gemini key {idx}: {e}")
        except ImportError:
            logger.warning("langchain_google_genai is not installed, skipping Gemini.")

    # 3. HuggingFace
    # Checks HF_TOKENS as present in your .env file
    hf_keys = _parse_keys("HF_TOKENS") 
    if hf_keys:
        logger.info("Trying HuggingFace provider...")
        
        def try_hf(endpoint_class, keys):
            model_name = "HuggingFaceH4/zephyr-7b-beta"
            for idx, key in enumerate(keys, 1):
                logger.info(f"Trying HuggingFace key {idx}/{len(keys)}")
                try:
                    llm = endpoint_class(repo_id=model_name, huggingfacehub_api_token=key, temperature=0.1, task="conversational")
                    response = llm.invoke(query)
                    return response
                except Exception as e:
                    logger.info(f"Error with HuggingFace key {idx}: {e}")
            return None

        # Try langchain_huggingface first, fallback to langchain_community
        try:
            from langchain_huggingface import HuggingFaceEndpoint
            res = try_hf(HuggingFaceEndpoint, hf_keys)
            if res: return res
        except ImportError:
            try:
                from langchain_community.llms import HuggingFaceEndpoint
                res = try_hf(HuggingFaceEndpoint, hf_keys)
                if res: return res
            except ImportError:
                logger.warning("langchain_huggingface and langchain_community not installed, skipping HuggingFace.")

    raise Exception("All LLM providers and keys exhausted. Could not get a response.")

class AllTokensExhaustedException(Exception):
    """Raised when all LLM providers and tokens are exhausted."""
    pass

def invoke_llm(model_names: list[str], prompt: str, parse_as_json: bool = False):
    """
    Invokes the LLM using the generic_llm handler. 
    Note: model_names is accepted for signature compatibility but ignored, 
    as generic_llm manages provider and model selection.
    """
    try:
        response = get_llm_response(prompt)
        if parse_as_json:
            import json, re
            # Extract json if parse_as_json is requested (inline simple extractor)
            match = re.search(r'\{.*\}', response.replace('\n', ''), re.DOTALL)
            if match:
                return json.loads(match.group(0))
            return json.loads(response)
        else:
            return response
    except Exception as e:
        raise AllTokensExhaustedException(f"Failed to generate response using generic LLM logic: {e}")

if __name__ == "__main__":
    # If run as a script, take the query from command line args or use a default
    user_query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Hi, who are you and what model are you based on?"
    
    print(f"--- Sending Query --- \n{user_query}\n")
    try:
        final_response = get_llm_response(user_query)
        print("\n--- LLM Response ---")
        try:
            print(final_response)
        except UnicodeEncodeError:
            print(final_response.encode('ascii', 'replace').decode('ascii'))
    except Exception as err:
        print(f"\n--- Error --- \n{err}")
