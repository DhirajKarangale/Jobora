import os
import sys
import redis
from dotenv import load_dotenv

load_dotenv()


class RedisClient:
    """
    Generic Redis utility for managing worker connections, stream polling, 
    message acknowledgements, stream cleanups, and pushing eligible jobs.
    """

    def __init__(self, worker_id: int = 1):
        self.worker_id = worker_id

        self.redis_url = os.getenv("REDIS_URL")
        if not self.redis_url:
            raise ValueError("Environment variable 'REDIS_URL' is required but not set.")

        self.stream_process = os.getenv("REDIS_CONSUMER_PROCESS")
        if not self.stream_process:
            raise ValueError("Environment variable 'REDIS_CONSUMER_PROCESS' is required but not set.")

        self.stream_eligible = os.getenv("REDIS_CONSUMER_ELIGIBLE")
        if not self.stream_eligible:
            raise ValueError("Environment variable 'REDIS_CONSUMER_ELIGIBLE' is required but not set.")

        check_rate_env = os.getenv("REDIS_CHECK_RATE")
        if not check_rate_env:
            raise ValueError("Environment variable 'REDIS_CHECK_RATE' is required but not set.")

        self.check_rate_ms = int(check_rate_env)
        self.consumer_group = f"{self.stream_process}_group"
        self.consumer_name = f"worker_{self.worker_id}_{os.getpid()}"

        connection_kwargs = {
            "decode_responses": True,
            "socket_timeout": 15,
            "socket_connect_timeout": 15
        }
        if self.redis_url.startswith("rediss://"):
            connection_kwargs["ssl_cert_reqs"] = None

        self.client = redis.Redis.from_url(self.redis_url, **connection_kwargs)
        self._init_consumer_group()

    def _init_consumer_group(self):
        """Ensure consumer group exists for REDIS_CONSUMER_PROCESS stream."""
        try:
            self.client.xgroup_create(
                name=self.stream_process,
                groupname=self.consumer_group,
                id="0",
                mkstream=True
            )
            print(f"[Worker-{self.worker_id}] Created Redis Consumer Group '{self.consumer_group}' for stream '{self.stream_process}'.", flush=True)
        except redis.exceptions.ResponseError as e:
            if "BUSYGROUP" in str(e):
                pass  # Consumer group already exists
            else:
                print(f"[Worker-{self.worker_id}] Warning initializing Consumer Group: {e}", flush=True)

    def check_and_get_job(self):
        """
        Checks if data is present in REDIS_CONSUMER_PROCESS stream and retrieves the next message.
        Returns (msg_id, job_id, message_data) or None if stream is empty.
        """
        response = self.client.xreadgroup(
            groupname=self.consumer_group,
            consumername=self.consumer_name,
            streams={self.stream_process: ">"},
            count=1,
            block=self.check_rate_ms
        )

        if not response:
            return None

        for stream, messages in response:
            for msg_id, data in messages:
                job_id = data.get("id") or data.get("job_id")
                return msg_id, job_id, data

        return None

    def acknowledge_job(self, msg_id: str):
        """Acknowledges message in REDIS_CONSUMER_PROCESS stream."""
        self.client.xack(self.stream_process, self.consumer_group, msg_id)

    def remove_job_from_process_stream(self, msg_id: str):
        """Deletes message from REDIS_CONSUMER_PROCESS stream after processing completion."""
        self.client.xdel(self.stream_process, msg_id)

    def push_to_eligible_stream(self, job_id: str, extra_data: dict = None):
        """
        Inserts new eligible job into REDIS_CONSUMER_ELIGIBLE stream.
        """
        payload = {"id": str(job_id)}
        if extra_data and isinstance(extra_data, dict):
            for k, v in extra_data.items():
                payload[str(k)] = str(v)

        msg_id = self.client.xadd(self.stream_eligible, payload)
        print(f"[Worker-{self.worker_id}] Inserted Job ID '{job_id}' into eligible stream '{self.stream_eligible}' (Msg ID: {msg_id}).", flush=True)
        return msg_id
