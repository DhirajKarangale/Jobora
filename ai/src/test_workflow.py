import os
import json
import sys

from utils.db import init_db, get_job, get_all_jobs
from graphs.graph import process_job_description
from dotenv import load_dotenv

load_dotenv()

def run_test():
    conn = None
    try:
        conn = init_db()
        
        # You can hardcode your specific job_id here:
        job_id = "d18ad235-6a74-444a-a770-d4c66e40c1c3"
        
        job = get_job(conn, job_id)
        
        # Fallback: if the hardcoded job_id doesn't exist or isn't set, grab the first available job
        if not job:
            print(f"Job {job_id} not found. Fetching a random job from DB instead...")
            all_jobs = get_all_jobs(conn)
            if not all_jobs:
                print("No jobs found in the database!")
                return
            job = all_jobs[0]
            job_id = job.get('id')
            print(f"Using Job ID: {job_id}")
            
        print(f"Processing Job ID: {job_id}...")
        
        # 1. Run the AI pipeline
        result = process_job_description(job)

        # 2. Extract Data
        eligible_val = str(result.get("eligible", "NO")).upper()
        
        structured_data = result.get("structured_data", {})
        structured_json = json.dumps(structured_data, indent=4, ensure_ascii=False)
        
        raw_description = job.get("description", "")
        cleaned_description = result.get("cleaned_description", "")
        
        eligibility_result = result.get("eligibility_result", {})
        eligibility_json = json.dumps(eligibility_result, indent=4, ensure_ascii=False)

        # 3. Save to a text file
        output_file = "workflow_test_result.txt"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write("="*50 + "\n")
            f.write(f"JOB ID: {job_id}\n")
            f.write("="*50 + "\n\n")
            
            f.write("--- ELIGIBILITY RESULT ---\n")
            f.write(f"Is Eligible: {eligible_val}\n")
            f.write(eligibility_json + "\n\n")
            
            f.write("--- STRUCTURED DATA ---\n")
            f.write(structured_json + "\n\n")
            
            f.write("--- CLEANED DESCRIPTION ---\n")
            f.write(cleaned_description + "\n\n")
            
            f.write("--- RAW DESCRIPTION ---\n")
            f.write(str(raw_description) + "\n\n")
            
        print(f"Done! Results saved to {output_file}")

    except Exception as e:
        print(f"Error during test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    run_test()
