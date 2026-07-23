import os
import sys
import time
import signal
import redis
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from workflow import manage_job_workflow
from utils.redis import RedisClient

load_dotenv()

running = True


def signal_handler(signum, frame):
    global running
    running = False


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def run_worker(worker_id: int = 1):
    redis_handler = RedisClient(worker_id=worker_id)
    is_busy = False

    while running:
        if is_busy:
            continue

        try:
            job_info = redis_handler.check_and_get_job()
            if not job_info:
                time.sleep(redis_handler.check_rate_ms / 1000.0)
                continue

            msg_id, job_id, message_data = job_info
            is_busy = True

            if job_id:
                redis_handler.acknowledge_job(msg_id)

                try:
                    manage_job_workflow(job_id=job_id, redis_handler=redis_handler, msg_id=msg_id)
                except Exception as wf_err:
                    pass
            else:
                redis_handler.acknowledge_job(msg_id)
                redis_handler.remove_job_from_process_stream(msg_id)

            is_busy = False

        except redis.exceptions.ConnectionError as ce:
            time.sleep(5)
        except Exception as e:
            if running:
                time.sleep(2)


if __name__ == "__main__":
    worker_id_arg = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    run_worker(worker_id_arg)
