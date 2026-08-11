import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv


def init_db():
    load_dotenv()

    db_host = os.getenv("DB_HOST")
    db_name = os.getenv("DB_NAME")
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_port = os.getenv("DB_PORT")

    required_env = {
        "DB_HOST": db_host,
        "DB_NAME": db_name,
        "DB_USER": db_user,
        "DB_PASSWORD": db_password,
        "DB_PORT": db_port
    }
    missing = [k for k, v in required_env.items() if not v]
    if missing:
        raise ValueError(f"Missing required database environment variable(s): {', '.join(missing)}")

    conn = psycopg2.connect(
        host=db_host,
        database=db_name,
        user=db_user,
        password=db_password,
        port=db_port
    )
    return conn


def get_all_jobs(conn):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT * FROM jobs ORDER BY added_date DESC;")
        rows = cur.fetchall()
        return [dict(row) for row in rows] if rows else []


def get_job(conn, job_id):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT * FROM jobs WHERE id = %s;", (job_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def update_job(conn, job_id, update_fields):
    if not update_fields:
        return None

    set_clause = ", ".join([f"{col} = %s" for col in update_fields.keys()])
    values = list(update_fields.values())
    values.append(job_id)

    query = f"UPDATE jobs SET {set_clause} WHERE id = %s RETURNING *;"

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(query, values)
        updated_job = cur.fetchone()

    conn.commit()
    return dict(updated_job) if updated_job else None


def delete_job(conn, job_id):
    with conn.cursor() as cur:
        cur.execute("DELETE FROM jobs WHERE id = %s;", (job_id,))
    conn.commit()
