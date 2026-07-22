from utils.db import init_db, get_all_jobs, get_job, update_job, delete_job
from graphs.graph import process_job_description

def main():
    try:
        conn = init_db()
        print("Database connected successfully!")
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return

    try:
        # Get a specific job
        job_id_phonepe_backend = "77e0fda6-baaa-4963-adec-46a12755c63e"
        job_id_eton_csharp = "04cfca07-f5c0-49c6-8f41-f033646a94c4"
        job_id_hackjob_java = "4c847b0a-5e98-4e14-bf80-d4e507afa844"
        job_id_eqnix_generic = "4c847b0a-5e98-4e14-bf80-d4e507afa844"
        job = get_job(conn, job_id_phonepe_backend)
        
        if job:
            result = process_job_description(job)
            import json
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print("Job not found.")

    finally:
        # Always make sure to close the connection when done
        conn.close()
        print("Database connection closed.")

if __name__ == "__main__":
    main()
