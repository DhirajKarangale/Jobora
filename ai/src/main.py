from utils.db import init_db, get_all_jobs, get_job, update_job, delete_job
from graphs.jd_cleaner.graph import process_job_description

def main():
    try:
        conn = init_db()
        print("Database connected successfully!")
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return

    try:
        # Get a specific job
        job_id = "008bdd12-39ca-4d5b-b61f-b46c9938f34b"
        job = get_job(conn, job_id)
        
        if job and job.get("description"):
            raw_desc = job["description"]
            
            # Run the cleaning & structuring workflow to get JSON data
            structured_json = process_job_description(raw_desc)
            
            import json
            print(json.dumps(structured_json, indent=2))
        else:
            print("Job not found or description is empty.")

    finally:
        # Always make sure to close the connection when done
        conn.close()
        print("Database connection closed.")

if __name__ == "__main__":
    main()
