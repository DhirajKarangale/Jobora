# Jobora AI Processor

## What is this?
The AI directory contains a powerful background worker application that automatically processes raw job descriptions for Jobora. It uses Large Language Models (LLMs) to clean up job postings, extract structured data (like required skills, salary, and experience), and logically determine if a specific candidate is eligible for the role.

## Technologies Used
- **Python:** The core language for the background workers.
- **LangGraph:** Orchestrates the multi-step, stateful AI pipeline.
- **Hugging Face:** Provides serverless endpoints for open-source LLM processing (e.g., Llama 3, Qwen).
- **Redis:** Message broker (using Redis Streams) to queue and reliably distribute jobs.
- **PostgreSQL:** The primary database for fetching raw job data and storing the extracted JSON results.

## How it works
1. **Listen:** The worker continuously listens to a Redis message queue for new job IDs pushed by the backend.
2. **Fetch:** When a job is picked up, it fetches the raw job details from the PostgreSQL database.
3. **Analyze:** It uses a 3-step AI pipeline to:
   - **Clean:** Remove HTML, formatting artifacts, and noise from the raw text while preserving technical details.
   - **Structure:** Extract key fields into a strict JSON format based on the cleaned text.
   - **Evaluate:** Compare the job requirements against a local candidate profile (`Dhiraj_Karangale_Profile.md`) to determine if the candidate is a match.
4. **Update:** It saves the structured JSON data and the boolean eligibility status back to the PostgreSQL database and acknowledges the message in Redis.

## Architecture
The application is designed for high throughput, reliability, and precision:

- **Multi-Processing:** The `main.py` entry point spins up multiple concurrent worker processes (`worker.py`) to handle a high volume of jobs simultaneously.
- **Stateful AI Pipeline:** Utilizes LangGraph (`graphs/graph.py`) to orchestrate the AI workflow, managing the state transitioning between cleaning, structuring, and evaluation nodes.
- **Resilient LLM Integration:** Communicates with Hugging Face serverless endpoints. It features a built-in **round-robin token rotation system**—if one API token hits a rate limit, it seamlessly cycles to the next available token (`utils/huggingface.py`) to ensure uninterrupted processing.
- **Robust Queuing:** Uses Redis Streams with Consumer Groups to ensure jobs are processed reliably and are not duplicated across different workers.

---

## How to Run

Follow these steps to run the AI processor locally. 

**Note:** The command examples below use `E:\FullStack\Jobora\ai>`, but you should navigate to the `ai` directory wherever the project is located on your local machine.

### 1. Install Dependencies
Ensure you have Python installed, then install the required packages:

```bash
E:\FullStack\Jobora\ai> pip install -r requirements.txt
```

### 2. Configure Environment Variables
Create a `.env` file in the `ai` directory and populate it with the necessary variables. Here is an explanation of what each variable does:

```env
# Database Configuration
DB_HOST=localhost         # The hostname of your PostgreSQL database
DB_NAME=jobora            # The name of your database
DB_USER=postgres          # Your database username
DB_PASSWORD=secret        # Your database password
DB_PORT=5432              # Your database port

# Redis Configuration
REDIS_URL=redis://localhost:6379/0  # URL to connect to your Redis instance
REDIS_CONSUMER_PROCESS=job_stream   # The name of the Redis stream the workers will listen to
REDIS_CHECK_RATE=2000               # Polling interval in milliseconds (e.g., 2000ms = 2 seconds)

# Application Configuration
WORKERS=4                 # Number of concurrent worker processes to spawn (adjust based on your CPU)

# Hugging Face Integration
# Comma-separated list of Hugging Face API tokens for rate-limit rotation
HF_TOKENS=your_hf_token_1,your_hf_token_2 
```

### 3. Configure Candidate Profile
The AI pipeline evaluates job eligibility against a specific candidate's profile. You must update the [`Dhiraj_Karangale_Profile.md`](file:///e:/FullStack/Jobora/ai/Dhiraj_Karangale_Profile.md) file in this directory with your own experience, skills, target roles, and preferences before running the processor.

### 4. Run the Test Workflow
Before starting the full worker pool, you can run the test script to verify that the AI pipeline can successfully process a sample job. This is useful for debugging changes to the prompts or logic.

```bash
E:\FullStack\Jobora\ai> python .\src\test_workflow.py
```

### 5. Run the Entire Project
To start the worker processes and begin polling jobs from the Redis queue in the background, run the main entry point:

```bash
E:\FullStack\Jobora\ai> python .\src\main.py
```

---

> *Note: This system is not perfect and is still evolving.*

<br/>

<div align="right">
  <strong>-DK-</strong>
</div>
