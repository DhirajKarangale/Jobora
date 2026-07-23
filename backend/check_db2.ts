import { pool } from './src/cloud/db/index.ts';
async function run() {
  try {
    await pool.query('ALTER TABLE jobs ADD COLUMN portal_link TEXT');
    console.log('Column portal_link added');
  } catch(e: any) {
    console.log(e.message);
  } finally {
    process.exit(0);
  }
}
run();
