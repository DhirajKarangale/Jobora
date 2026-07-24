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

pool.on('error', (err, _client) => {
  console.error('Unexpected error on idle database client', err);
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

  const { rows } = await pool.query<{ source_job_id: string; external_job_id: string }>(
    `
    SELECT source_job_id, external_job_id
    FROM jobs
    WHERE source_job_id = ANY($1::text[]) OR external_job_id = ANY($1::text[])
    `,
    [ids]
  );

  const existingIds = new Set<string>();

  for (const row of rows) {
    if (row.source_job_id) existingIds.add(row.source_job_id);
    if (row.external_job_id) existingIds.add(row.external_job_id);
  }

  return ids.filter(id => !existingIds.has(id));
}

export async function saveJob(data: DataJob): Promise<string> {
  const query = `
    INSERT INTO jobs (
      source,
      source_job_id,
      company,
      external_job_id,
      description,
      apply_link,
      added_date,
      portal_link, 
      role
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
    data.role,
  ];

  const { rows } = await pool.query(query, values);
  return rows[0].id;
}
export async function saveEligibleAndAppliedJob(data: DataJob): Promise<string> {
  const query = `
    INSERT INTO jobs (
      source,
      source_job_id,
      company,
      external_job_id,
      description,
      apply_link,
      is_eligible,
      added_date,
      applied_date,
      portal_link,
      role,
      is_auto_apply
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
    data.role,
    true
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
  role: string | null;
}

export async function getAllEligibleJobs(): Promise<DataJobFrontend[]> {
  const query = `
    SELECT id, source, company, description, apply_link, (applied_date IS NOT NULL) AS isapplied, added_date, is_expired, portal_link, role
    FROM jobs
    WHERE is_eligible IS NOT NULL
      AND is_eligible = true
      AND applied_date IS NULL
      AND (is_expired IS NULL OR is_expired = false)
    ORDER BY id DESC
  `;

  const { rows } = await pool.query(query);

  return rows.map(r => ({
    id: String(r.id),
    sourceName: r.source,
    companyName: r.company,
    description: r.description,
    link: r.apply_link,
    isApplied: Boolean(r.isapplied),
    addedDate: r.added_date ? new Date(r.added_date).toISOString() : null,
    isExpired: Boolean(r.is_expired),
    portal_link: r.portal_link,
    role: r.role,
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
      WHERE id = $1::uuid OR source_job_id = $1::text OR external_job_id = $1::text
    `;
    params = [jobId, appliedValue];
  } else {
    query = `
      UPDATE jobs
      SET applied_date = $2
      WHERE source_job_id = $1 OR external_job_id = $1
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
      SET is_expired = $2
      WHERE id = $1::uuid OR source_job_id = $1::text OR external_job_id = $1::text
    `;
    params = [jobId, isExpired];
  } else {
    query = `
      UPDATE jobs
      SET is_expired = $2
      WHERE source_job_id = $1 OR external_job_id = $1
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
    autoAppliedJobs: number;
    manualAppliedJobs: number;
  };
  timeSeries: {
    date: string;
    totalJobs: number;
    eligibleJobs: number;
    appliedJobs: number;
  }[];
  jobsBySource: { name: string; count: number }[];
  jobsByCompany: { name: string; count: number }[];
  statusBreakdown: { name: string; value: number }[];
  jobsList: any[];
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
    filterQuery += ` AND source ILIKE $${paramIndex}`;
    queryParams.push(`%${sourceName}%`);
    paramIndex++;
  }

  if (companyName) {
    filterQuery += ` AND company ILIKE $${paramIndex}`;
    queryParams.push(`%${companyName}%`);
    paramIndex++;
  }

  const summaryQuery = `
    SELECT 
      COUNT(*) as total_jobs,
      COUNT(CASE WHEN applied_date IS NOT NULL THEN 1 END) as applied_jobs,
      COUNT(CASE WHEN applied_date IS NOT NULL AND is_auto_apply = true THEN 1 END) as auto_applied_jobs,
      COUNT(CASE WHEN applied_date IS NOT NULL AND (is_auto_apply IS NULL OR is_auto_apply = false) THEN 1 END) as manual_applied_jobs,
      COUNT(CASE WHEN applied_date IS NULL AND (is_eligible IS NULL OR is_eligible = false) THEN 1 END) as not_eligible_jobs,
      COUNT(CASE WHEN applied_date IS NULL AND is_eligible = true AND is_expired = true THEN 1 END) as expired_jobs,
      COUNT(CASE WHEN applied_date IS NULL AND is_eligible = true AND (is_expired IS NULL OR is_expired = false) THEN 1 END) as active_jobs
    FROM jobs
    ${filterQuery}
  `;

  const timeSeriesQuery = `
    SELECT 
      DATE(added_date) as date,
      COUNT(*) as total_jobs,
      COUNT(CASE WHEN is_eligible = true AND applied_date IS NULL AND (is_expired IS NULL OR is_expired = false) THEN 1 END) as eligible_jobs,
      COUNT(CASE WHEN applied_date IS NOT NULL THEN 1 END) as applied_jobs
    FROM jobs
    ${filterQuery}
    GROUP BY DATE(added_date)
    ORDER BY date ASC
  `;

  const jobsBySourceQuery = `
    SELECT source as name, COUNT(*) as count
    FROM jobs
    ${filterQuery} AND source IS NOT NULL
    GROUP BY source
    ORDER BY count DESC
  `;

  const jobsByCompanyQuery = `
    SELECT company as name, COUNT(*) as count
    FROM jobs
    ${filterQuery} AND company IS NOT NULL
    GROUP BY company
    ORDER BY count DESC
    LIMIT 10
  `;

  const jobsListQuery = `
    SELECT 
      id, source, company, description, apply_link, 
      (applied_date IS NOT NULL) AS isapplied, 
      added_date, is_expired, portal_link,
      is_eligible, applied_date, role
    FROM jobs
    ${filterQuery}
    ORDER BY added_date DESC
    LIMIT 100
  `;

  const [summaryResult, timeSeriesResult, sourceResult, companyResult, jobsListResult] = await Promise.all([
    pool.query(summaryQuery, queryParams),
    pool.query(timeSeriesQuery, queryParams),
    pool.query(jobsBySourceQuery, queryParams),
    pool.query(jobsByCompanyQuery, queryParams),
    pool.query(jobsListQuery, queryParams)
  ]);

  const summary = summaryResult.rows[0];

  const timeSeries = timeSeriesResult.rows.map(row => ({
    date: new Date(row.date).toISOString().split('T')[0],
    totalJobs: Number(row.total_jobs),
    eligibleJobs: Number(row.eligible_jobs),
    appliedJobs: Number(row.applied_jobs),
  }));

  const statusBreakdown = [
    { name: 'Active (To Apply)', value: Number(summary.active_jobs) },
    { name: 'Not Eligible', value: Number(summary.not_eligible_jobs) },
    { name: 'Auto Applied', value: Number(summary.auto_applied_jobs) },
    { name: 'Manual Applied', value: Number(summary.manual_applied_jobs) },
    { name: 'Expired', value: Number(summary.expired_jobs) }
  ].filter(item => item.value > 0);

  const jobsList = jobsListResult.rows.map(r => ({
    id: String(r.id),
    sourceName: r.source,
    companyName: r.company,
    description: r.description,
    link: r.apply_link,
    isApplied: Boolean(r.isapplied),
    addedDate: r.added_date ? new Date(r.added_date).toISOString() : null,
    isExpired: Boolean(r.is_expired),
    portal_link: r.portal_link,
    isEligible: r.is_eligible !== null ? Boolean(r.is_eligible) : undefined,
    appliedDate: r.applied_date ? new Date(r.applied_date).toISOString() : null,
    role: r.role,
  }));

  return {
    summary: {
      totalJobs: Number(summary.total_jobs),
      eligibleJobs: Number(summary.active_jobs),
      appliedJobs: Number(summary.applied_jobs),
      autoAppliedJobs: Number(summary.auto_applied_jobs),
      manualAppliedJobs: Number(summary.manual_applied_jobs)
    },
    timeSeries,
    jobsBySource: sourceResult.rows.map(r => ({ name: r.name, count: Number(r.count) })),
    jobsByCompany: companyResult.rows.map(r => ({ name: r.name, count: Number(r.count) })),
    statusBreakdown,
    jobsList
  };
}

export async function getFilterOptions(sourceName?: string, companyName?: string): Promise<{ sources: string[], companies: string[] }> {
  let sourcesQuery = `SELECT DISTINCT source FROM jobs WHERE source IS NOT NULL`;
  let companiesQuery = `SELECT DISTINCT company FROM jobs WHERE company IS NOT NULL`;

  const sourceParams: any[] = [];
  const companyParams: any[] = [];

  if (companyName) {
    sourcesQuery += ` AND company ILIKE $1`;
    sourceParams.push(`%${companyName}%`);
  }
  sourcesQuery += ` ORDER BY source ASC`;

  if (sourceName) {
    companiesQuery += ` AND source ILIKE $1`;
    companyParams.push(`%${sourceName}%`);
  }
  companiesQuery += ` ORDER BY company ASC`;

  const [sourcesResult, companiesResult] = await Promise.all([
    pool.query(sourcesQuery, sourceParams),
    pool.query(companiesQuery, companyParams)
  ]);

  return {
    sources: sourcesResult.rows.map(r => r.source),
    companies: companiesResult.rows.map(r => r.company)
  };
}

export default pool;
