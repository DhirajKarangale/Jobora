import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

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
    console.log("Connected to PostgreSQL database successfully.");
    client.release();
    return pool;
  } catch (error) {
    console.error("Failed to connect to PostgreSQL database:", error);
    throw error;
  }
}

export default pool;