import pool from "./config.ts";

export async function filterExistingJobIds(jobIds: Set<string>) {
  if (jobIds.size === 0) return [];

  const ids = [...jobIds];

  const { rows } = await pool.query<{ source_jobid: string; jobid: string; }>(
    `
    SELECT source_jobid, jobid
    FROM jobs
    WHERE source_jobid = ANY($1::text[]) OR jobid = ANY($1::text[])
    `,
    [ids]
  );

  const existingIds = new Set<string>();

  for (const row of rows) {
    existingIds.add(row.source_jobid);
    existingIds.add(row.jobid);
  }

  return ids.filter(id => !existingIds.has(id));
}