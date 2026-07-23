import { pool } from './src/cloud/db/index.ts';
async function run() {
  try {
    await pool.query('ALTER TABLE jobs ADD COLUMN isexpired BOOLEAN DEFAULT false');
    console.log('Column added');
  } catch(e: any) {
    console.log(e.message);
  } finally {
    process.exit(0);
  }
}
run();
