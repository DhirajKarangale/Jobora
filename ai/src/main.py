import os
import sys
import multiprocessing
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from worker import run_worker

load_dotenv()


def main():
    workers_env = os.getenv("WORKERS")
    if not workers_env:
        raise ValueError("Environment variable 'WORKERS' is required but not set.")

    workers_count = int(workers_env)
    print(f"[Main] Starting Jobora AI Engine with {workers_count} workers...", flush=True)

    processes = []

    try:
        for i in range(1, workers_count + 1):
            p = multiprocessing.Process(
                target=run_worker,
                args=(i,),
                name=f"WorkerProcess-{i}"
            )
            p.daemon = True
            p.start()
            processes.append(p)

        for p in processes:
            p.join()

    except KeyboardInterrupt:
        print("\n[Main] Terminating worker processes...", flush=True)
        for p in processes:
            if p.is_alive():
                p.terminate()
                p.join()


if __name__ == "__main__":
    main()
