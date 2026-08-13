import json
import sys
from utils.db import init_db, get_job, update_job
from graphs.graph import process_job_description


def manage_job_workflow(job_id: str, redis_handler=None, msg_id: str = None):
    conn = None
    try:
        conn = init_db()
        job = get_job(conn, job_id)

        if not job:
            if redis_handler and msg_id:
                redis_handler.remove_job_from_process_stream(msg_id)
            return None

        result = process_job_description(job)

        if not result or not isinstance(result, dict) or "eligible" not in result:
            raise ValueError(f"Processing failed or returned invalid result structure for job ID {job_id}")

        eligible_val = str(result.get("eligible", "NO")).strip().upper()
        is_eligible = True if eligible_val in ["YES", "TRUE", "ELIGIBLE"] else False

        structured_data = result.get("structured_data", {})
        if not structured_data:
            raise ValueError(f"Processing failed: structured_data is empty for job ID {job_id}")

        structured_json = json.dumps(structured_data, ensure_ascii=False)

        update_fields = {
            "description": structured_json,
            "is_eligible": is_eligible,
            "fit_resume": result.get("fit_resume") if is_eligible else None
        }

        updated_job = update_job(conn, job_id, update_fields)

        if redis_handler and msg_id:
            redis_handler.remove_job_from_process_stream(msg_id)

        return updated_job, is_eligible, update_fields["fit_resume"]

    except Exception as e:
        if redis_handler and msg_id:
            try:
                redis_handler.remove_job_from_process_stream(msg_id)
            except Exception:
                pass
        raise e
    finally:
        if conn:
            conn.close()

