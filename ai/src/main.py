from utils.db import init_db, get_all_jobs, get_job, update_job, delete_job

def main():
    try:
        conn = init_db()
        print("Database connected successfully!")
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return

    try:
        # Example usage of the database functions:
        
        # 1. Get all jobs
        # jobs = get_all_jobs(conn)
        # print(f"Found {len(jobs)} jobs.")
        
        # 2. Update a job (assuming you have a valid UUID to test with)
        # job_id_to_update = "some-uuid-here"
        # updated = update_job(conn, job_id_to_update, {"match": 0.95, "company_name": "New Company"})
        # print("Updated job:", updated)
        
        # 3. Delete a job
        # job_id_to_delete = "another-uuid-here"
        # delete_job(conn, job_id_to_delete)
        # print("Job deleted.")

        job = get_job(conn, "008bdd12-39ca-4d5b-b61f-b46c9938f34b")
        print(f"Job: {job}")
        
        pass # Remove this when you uncomment the examples above

    finally:
        # Always make sure to close the connection when done
        conn.close()
        print("Database connection closed.")

if __name__ == "__main__":
    main()
