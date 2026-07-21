import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

def init_db():
    """Load environment variables and establish a database connection."""
    load_dotenv()
    
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        port=os.getenv("DB_PORT", 5432)
    )
    return conn

def get_all_jobs(conn):
    """
    Retrieve all jobs from the jobs table.
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        rows = cur.fetchall()
        return [dict(row) for row in rows] if rows else []

def get_job(conn, job_id):
    """
    Retrieve a specific job from the jobs table by its ID.
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT * FROM jobs WHERE id = %s;", (job_id,))
        row = cur.fetchone()
        return dict(row) if row else None

def update_job(conn, job_id, update_fields):
    """
    Update specific fields for a given job.
    
    :param conn: Database connection object
    :param job_id: The UUID of the job to update
    :param update_fields: A dictionary mapping column names to new values
    """
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
    """
    Delete a job from the jobs table by its ID.
    
    :param conn: Database connection object
    :param job_id: The UUID of the job to delete
    """
    with conn.cursor() as cur:
        cur.execute("DELETE FROM jobs WHERE id = %s;", (job_id,))
    conn.commit()
