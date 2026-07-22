import json
import sys
from utils.db import init_db, get_job, update_job
from graphs.graph import process_job_description


def manage_job_workflow(job_id: str):
    conn = None
    try:
        conn = init_db()
        job = get_job(conn, job_id)

        if not job:
            print(f"[Error] Job with ID '{job_id}' not found in database.")
            return None

        result = process_job_description(job)

        eligible_val = str(result.get("eligible", "NO")).upper()
        is_eligible = True if eligible_val == "YES" else False

        structured_data = result.get("structured_data", {})
        structured_json = json.dumps(structured_data, ensure_ascii=False)

        update_fields = {
            "description": structured_json,
            "iseligible": is_eligible
        }

        updated_job = update_job(conn, job_id, update_fields)

        if is_eligible:
            print(f"Eligible Job ID: {job_id}")

        return updated_job

    except Exception as e:
        print(f"[Error] Failed to execute workflow for job ID '{job_id}': {e}")
        raise e
    finally:
        if conn:
            conn.close()
