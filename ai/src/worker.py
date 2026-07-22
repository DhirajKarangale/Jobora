import os
import sys
import time
import signal
import redis
from dotenv import load_dotenv

# Ensure src directory is in Python path for workflow import
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from workflow import manage_job_workflow
from utils.redis import RedisClient

load_dotenv()

running = True


def signal_handler(signum, frame):
    global running
    print(f"[Worker] Signal {signum} received. Stopping worker loop...", flush=True)
    running = False


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def run_worker(worker_id: int = 1):
    """
    Worker function running in a parallel process.
    Uses generic RedisClient to poll REDIS_CONSUMER_PROCESS, process jobs, acknowledge, 
    remove processed messages, and push eligible jobs to REDIS_CONSUMER_ELIGIBLE.
    """
    redis_handler = RedisClient(worker_id=worker_id)
    print(f"[Worker-{worker_id}] Worker active. Polling for jobs (check rate: {redis_handler.check_rate_ms}ms)...", flush=True)

    is_busy = False

    while running:
        if is_busy:
            # Worker is busy processing a job; skip polling until idle
            continue

        try:
            # Check and fetch data from REDIS_CONSUMER_PROCESS
            job_info = redis_handler.check_and_get_job()
            if not job_info:
                time.sleep(redis_handler.check_rate_ms / 1000.0)
                continue

            msg_id, job_id, message_data = job_info
            is_busy = True

            print(f"[Worker-{worker_id}] Processing Job ID '{job_id}' (Message ID: {msg_id})...", flush=True)

            if job_id:
                # 1. Acknowledge receipt in REDIS_CONSUMER_PROCESS
                redis_handler.acknowledge_job(msg_id)
                print(f"[Worker-{worker_id}] Acknowledged message '{msg_id}' in process stream.", flush=True)

                try:
                    # 2. Run workflow processing (handles DB update, eligible stream insertion, and stream cleanup)
                    manage_job_workflow(job_id=job_id, redis_handler=redis_handler, msg_id=msg_id)
                except Exception as wf_err:
                    print(f"[Worker-{worker_id}] Error executing workflow for Job ID '{job_id}': {wf_err}", flush=True)
            else:
                print(f"[Worker-{worker_id}] Warning: No 'id' or 'job_id' found in payload: {message_data}", flush=True)
                redis_handler.acknowledge_job(msg_id)
                redis_handler.remove_job_from_process_stream(msg_id)

            is_busy = False

        except redis.exceptions.ConnectionError as ce:
            print(f"[Worker-{worker_id}] Redis Connection Error: {ce}. Retrying in 5 seconds...", flush=True)
            time.sleep(5)
        except Exception as e:
            if running:
                print(f"[Worker-{worker_id}] Unexpected error in worker loop: {e}", flush=True)
                time.sleep(2)

    print(f"[Worker-{worker_id}] Worker stopped cleanly.", flush=True)


if __name__ == "__main__":
    worker_id_arg = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    run_worker(worker_id_arg)
