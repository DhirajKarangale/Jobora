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
  max: 20, // Keep active pool connections ready to prevent handshake overhead
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
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

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
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
    RETURNING id;
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
  isApplied: boolean;
}

export async function getJobsByIds(jobIds: string[]): Promise<DataJobFrontend[]> {
  if (jobIds.length === 0) return [];

  const uuids: string[] = [];
  const textIds: string[] = [];

  for (const id of jobIds) {
    if (isUuid(id)) {
      uuids.push(id);
    } else {
      textIds.push(id);
    }
  }

  let query = "";
  let params: any[] = [];

  if (uuids.length > 0 && textIds.length > 0) {
    query = `
      SELECT id, source_name, company_name, description, link, COALESCE(isapplied, false) AS isapplied
      FROM jobs
      WHERE (id = ANY($1::uuid[]) OR source_jobid = ANY($2::text[]) OR jobid = ANY($2::text[]))
        AND iseligible IS NOT NULL
        AND iseligible = true
        AND (isapplied IS NULL OR isapplied = false)
      ORDER BY id DESC
    `;
    params = [uuids, textIds];
  } else if (uuids.length > 0) {
    query = `
      SELECT id, source_name, company_name, description, link, COALESCE(isapplied, false) AS isapplied
      FROM jobs
      WHERE id = ANY($1::uuid[])
        AND iseligible IS NOT NULL
        AND iseligible = true
        AND (isapplied IS NULL OR isapplied = false)
      ORDER BY id DESC
    `;
    params = [uuids];
  } else {
    query = `
      SELECT id, source_name, company_name, description, link, COALESCE(isapplied, false) AS isapplied
      FROM jobs
      WHERE (source_jobid = ANY($1::text[]) OR jobid = ANY($1::text[]))
        AND iseligible IS NOT NULL
        AND iseligible = true
        AND (isapplied IS NULL OR isapplied = false)
      ORDER BY id DESC
    `;
    params = [textIds];
  }

  const { rows } = await pool.query(query, params);

  return rows.map(r => ({
    id: String(r.id),
    sourceName: r.source_name,
    companyName: r.company_name,
    description: r.description,
    link: r.link,
    isApplied: Boolean(r.isapplied),
  }));
}

export async function setJobAppliedStatus(jobId: string, isApplied: boolean): Promise<boolean> {
  if (!jobId) return false;

  let query = "";
  let params: any[] = [];

  if (isUuid(jobId)) {
    query = `
      UPDATE jobs
      SET isapplied = $2
      WHERE id = $1::uuid OR source_jobid = $1::text OR jobid = $1::text
    `;
    params = [jobId, isApplied];
  } else {
    query = `
      UPDATE jobs
      SET isapplied = $2
      WHERE source_jobid = $1 OR jobid = $1
    `;
    params = [jobId, isApplied];
  }

  const { rowCount } = await pool.query(query, params);
  return (rowCount ?? 0) > 0;
}

export async function getJobIdentifiers(jobId: string): Promise<string[]> {
  let query = "";
  let params: any[] = [];

  if (isUuid(jobId)) {
    query = `SELECT id::text, source_jobid, jobid FROM jobs WHERE id = $1::uuid OR source_jobid = $1::text OR jobid = $1::text`;
    params = [jobId];
  } else {
    query = `SELECT id::text, source_jobid, jobid FROM jobs WHERE source_jobid = $1 OR jobid = $1`;
    params = [jobId];
  }

  const { rows } = await pool.query<{ id: string; source_jobid: string | null; jobid: string | null }>(query, params);
  const ids: string[] = [];
  for (const row of rows) {
    if (row.id) ids.push(String(row.id));
    if (row.source_jobid) ids.push(row.source_jobid);
    if (row.jobid) ids.push(row.jobid);
  }
  if (ids.length === 0) ids.push(jobId);
  return Array.from(new Set(ids));
}

export default pool;
