import json
import sys
from utils.db import init_db, get_job, update_job
from graphs.graph import process_job_description


def manage_job_workflow(job_id: str, redis_handler=None, msg_id: str = None):
    """
    Manages the job qualification workflow.
    - Updates Postgres DB with structured JSON and iseligible flag.
    - If is_eligible is True, inserts job_id into REDIS_CONSUMER_ELIGIBLE stream.
    - After process completes, removes the job message from REDIS_CONSUMER_PROCESS stream.
    """
    conn = None
    try:
        conn = init_db()
        job = get_job(conn, job_id)

        if not job:
            print(f"[Error] Job with ID '{job_id}' not found in database.", flush=True)
            if redis_handler and msg_id:
                redis_handler.remove_job_from_process_stream(msg_id)
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

        # 1. Check if is_eligible is True; if so, enter job_id in REDIS_CONSUMER_ELIGIBLE
        if is_eligible:
            print(f"Eligible Job ID: {job_id}", flush=True)
            if redis_handler:
                redis_handler.push_to_eligible_stream(job_id)

        # 2. After process completes, consider processing completed and remove that job from REDIS_CONSUMER_PROCESS
        if redis_handler and msg_id:
            redis_handler.remove_job_from_process_stream(msg_id)
            print(f"[Workflow] Processing completed. Removed message '{msg_id}' from process stream.", flush=True)

        return updated_job

    except Exception as e:
        print(f"[Error] Failed to execute workflow for job ID '{job_id}': {e}", flush=True)
        if redis_handler and msg_id:
            try:
                redis_handler.remove_job_from_process_stream(msg_id)
            except Exception:
                pass
        raise e
    finally:
        if conn:
            conn.close()
