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
  max: 20,
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
      link,
      added_date,
      portal_link
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id;
  `;

  const values = [
    data.sourceName,
    data.sourceJobId,
    data.companyName,
    data.jobId,
    data.description,
    data.link,
    new Date(),
    data.portal_link || null,
  ];

  const { rows } = await pool.query(query, values);
  return rows[0].id;
}
export async function saveEligibleAndAppliedJob(data: DataJob): Promise<string> {
  const query = `
    INSERT INTO jobs (
      source_name,
      source_jobId,
      company_name,
      jobId,
      description,
      link,
      iseligible,
      added_date,
      applied_date,
      portal_link
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id;
  `;

  const values = [
    data.sourceName,
    data.sourceJobId,
    data.companyName,
    data.jobId,
    data.description,
    data.link,
    true,
    new Date(),
    new Date(),
    data.portal_link || null,
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
  addedDate: string | null;
  isExpired: boolean;
  portal_link: string | null;
}

export async function getAllEligibleJobs(): Promise<DataJobFrontend[]> {
  const query = `
    SELECT id, source_name, company_name, description, link, (applied_date IS NOT NULL) AS isapplied, added_date, isexpired, portal_link
    FROM jobs
    WHERE iseligible IS NOT NULL
      AND iseligible = true
      AND applied_date IS NULL
      AND (isexpired IS NULL OR isexpired = false)
    ORDER BY id DESC
  `;

  const { rows } = await pool.query(query);

  return rows.map(r => ({
    id: String(r.id),
    sourceName: r.source_name,
    companyName: r.company_name,
    description: r.description,
    link: r.link,
    isApplied: Boolean(r.isapplied),
    addedDate: r.added_date ? new Date(r.added_date).toISOString() : null,
    isExpired: Boolean(r.isexpired),
    portal_link: r.portal_link,
  }));
}

export async function setJobAppliedStatus(jobId: string, isApplied: boolean): Promise<boolean> {
  if (!jobId) return false;

  let query = "";
  let params: any[] = [];

  const appliedValue = isApplied ? new Date() : null;

  if (isUuid(jobId)) {
    query = `
      UPDATE jobs
      SET applied_date = $2
      WHERE id = $1::uuid OR source_jobid = $1::text OR jobid = $1::text
    `;
    params = [jobId, appliedValue];
  } else {
    query = `
      UPDATE jobs
      SET applied_date = $2
      WHERE source_jobid = $1 OR jobid = $1
    `;
    params = [jobId, appliedValue];
  }

  const { rowCount } = await pool.query(query, params);
  return (rowCount ?? 0) > 0;
}

export async function setJobExpiredStatus(jobId: string, isExpired: boolean): Promise<boolean> {
  if (!jobId) return false;

  let query = "";
  let params: any[] = [];

  if (isUuid(jobId)) {
    query = `
      UPDATE jobs
      SET isexpired = $2
      WHERE id = $1::uuid OR source_jobid = $1::text OR jobid = $1::text
    `;
    params = [jobId, isExpired];
  } else {
    query = `
      UPDATE jobs
      SET isexpired = $2
      WHERE source_jobid = $1 OR jobid = $1
    `;
    params = [jobId, isExpired];
  }

  const { rowCount } = await pool.query(query, params);
  return (rowCount ?? 0) > 0;
}



export interface AnalyticsFilter {
  dateRange: string;
  sourceName?: string;
  companyName?: string;
}

export interface AnalyticsData {
  summary: {
    totalJobs: number;
    eligibleJobs: number;
    appliedJobs: number;
  };
  timeSeries: {
    date: string;
    totalJobs: number;
    eligibleJobs: number;
    appliedJobs: number;
  }[];
}

export async function getAnalyticsData(filters: AnalyticsFilter): Promise<AnalyticsData> {
  const { dateRange, sourceName, companyName } = filters;

  let startDate = new Date();
  switch (dateRange) {
    case '1d': startDate.setDate(startDate.getDate() - 1); break;
    case '2d': startDate.setDate(startDate.getDate() - 2); break;
    case '3d': startDate.setDate(startDate.getDate() - 3); break;
    case '1w': startDate.setDate(startDate.getDate() - 7); break;
    case '2w': startDate.setDate(startDate.getDate() - 14); break;
    case '1m': startDate.setMonth(startDate.getMonth() - 1); break;
    case '2m': startDate.setMonth(startDate.getMonth() - 2); break;
    case '3m': startDate.setMonth(startDate.getMonth() - 3); break;
    case '6m': startDate.setMonth(startDate.getMonth() - 6); break;
    case '1y': startDate.setFullYear(startDate.getFullYear() - 1); break;
    case '1.5y': startDate.setMonth(startDate.getMonth() - 18); break;
    case 'all':
    default:
      startDate = new Date(0);
      break;
  }

  const queryParams: any[] = [startDate];
  let filterQuery = `WHERE added_date >= $1`;

  let paramIndex = 2;
  if (sourceName) {
    filterQuery += ` AND source_name ILIKE $${paramIndex}`;
    queryParams.push(`%${sourceName}%`);
    paramIndex++;
  }

  if (companyName) {
    filterQuery += ` AND company_name ILIKE $${paramIndex}`;
    queryParams.push(`%${companyName}%`);
    paramIndex++;
  }

  const summaryQuery = `
    SELECT 
      COUNT(*) as total_jobs,
      COUNT(CASE WHEN iseligible = true THEN 1 END) as eligible_jobs,
      COUNT(CASE WHEN applied_date IS NOT NULL THEN 1 END) as applied_jobs
    FROM jobs
    ${filterQuery}
  `;

  const timeSeriesQuery = `
    SELECT 
      DATE(added_date) as date,
      COUNT(*) as total_jobs,
      COUNT(CASE WHEN iseligible = true THEN 1 END) as eligible_jobs,
      COUNT(CASE WHEN applied_date IS NOT NULL THEN 1 END) as applied_jobs
    FROM jobs
    ${filterQuery}
    GROUP BY DATE(added_date)
    ORDER BY date ASC
  `;

  const [summaryResult, timeSeriesResult] = await Promise.all([
    pool.query(summaryQuery, queryParams),
    pool.query(timeSeriesQuery, queryParams)
  ]);

  const summary = summaryResult.rows[0];
  
  const timeSeries = timeSeriesResult.rows.map(row => ({
    date: new Date(row.date).toISOString().split('T')[0],
    totalJobs: Number(row.total_jobs),
    eligibleJobs: Number(row.eligible_jobs),
    appliedJobs: Number(row.applied_jobs),
  }));

  return {
    summary: {
      totalJobs: Number(summary.total_jobs),
      eligibleJobs: Number(summary.eligible_jobs),
      appliedJobs: Number(summary.applied_jobs)
    },
    timeSeries
  };
}

export async function getFilterOptions(): Promise<{ sources: string[], companies: string[] }> {
  const sourcesQuery = `SELECT DISTINCT source_name FROM jobs WHERE source_name IS NOT NULL ORDER BY source_name ASC`;
  const companiesQuery = `SELECT DISTINCT company_name FROM jobs WHERE company_name IS NOT NULL ORDER BY company_name ASC`;
  
  const [sourcesResult, companiesResult] = await Promise.all([
    pool.query(sourcesQuery),
    pool.query(companiesQuery)
  ]);
  
  return {
    sources: sourcesResult.rows.map(r => r.source_name),
    companies: companiesResult.rows.map(r => r.company_name)
  };
}

export default pool;
