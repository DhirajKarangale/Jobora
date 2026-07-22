import { Pool } from "pg";
import dotenv from "dotenv";
import { DataJob } from "../../utils/constants.ts";

dotenv.config();

const requiredEnvVars = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required database environment variable(s): ${missingEnvVars.join(", ")}`);
}

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: true,
  },
});

export async function connectDb() {
  try {
    const client = await pool.connect();
    client.release();
    return pool;
  } catch (error) {
    console.error("Failed to connect to PostgreSQL database:", error);
    throw error;
  }
}

export async function filterExistingJobIds(jobIds: Set<string>): Promise<string[]> {
  if (jobIds.size === 0) return [];

  const ids = [...jobIds];

  const { rows } = await pool.query<{ source_jobid: string; jobid: string }>(
    `
    SELECT source_jobid, jobid
    FROM jobs
    WHERE source_jobid = ANY($1::text[]) OR jobid = ANY($1::text[])
    `,
    [ids]
  );

  const existingIds = new Set<string>();

  for (const row of rows) {
    if (row.source_jobid) existingIds.add(row.source_jobid);
    if (row.jobid) existingIds.add(row.jobid);
  }

  return ids.filter(id => !existingIds.has(id));
}

export async function saveJob(data: DataJob): Promise<string> {
  const query = `
    INSERT INTO jobs (
      source_name,
      source_jobId,
      company_name,
      jobId,
      description,
      link
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;

  const values = [
    data.sourceName,
    data.sourceJobId,
    data.companyName,
    data.jobId,
    data.description,
    data.link,
  ];

  const { rows } = await pool.query(query, values);
  return rows[0].id;
}

export interface DataJobFrontend {
  id: string;
  sourceName: string;
  companyName: string | null;
  description: string | null;
  link: string | null;
}

export async function getJobsByIds(jobIds: string[]): Promise<DataJobFrontend[]> {
  if (jobIds.length === 0) return [];

  const { rows } = await pool.query(
    `
    SELECT id, source_name, company_name, description, link
    FROM jobs
    WHERE id::text = ANY($1::text[]) OR source_jobid = ANY($1::text[])
    ORDER BY id DESC
    `,
    [jobIds]
  );

  return rows.map(r => ({
    id: String(r.id),
    sourceName: r.source_name,
    companyName: r.company_name,
    description: r.description,
    link: r.link,
  }));
}

export default pool;
