import pool from "./config.ts";
import { DataJob } from "../data/data.ts";

export async function saveJob(data: DataJob) {
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

  await pool.query(query, values);
}