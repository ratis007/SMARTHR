const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

loadEnvFile(path.resolve(__dirname, '../.env.test'));
loadEnvFile(path.resolve(__dirname, '../.env'));

const targetDatabase = process.env.PAYROLL_API_TEST_DB_NAME || 'smarthr_test';
assertTestDatabase(targetDatabase);

const connection = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
};

const sqlFiles = [
  path.resolve(__dirname, '../../database/schema.sql'),
  path.resolve(__dirname, '../../database/upgrade_platform_settings.sql'),
  path.resolve(__dirname, '../../database/upgrade_payroll_engine.sql'),
  path.resolve(__dirname, '../../database/upgrade_time_attendance.sql'),
];

async function run() {
  await ensureDatabase();
  await applySchema();
  console.log(`Payroll API test database ready: ${targetDatabase}`);
  console.log('Start the API with npm run start:test:payroll-api before running npm run test:payroll:api');
}

async function ensureDatabase() {
  const client = new Client({ ...connection, database: process.env.DB_MAINTENANCE_NAME || 'postgres' });
  await client.connect();
  const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDatabase]);
  if (!result.rowCount) {
    await client.query(`CREATE DATABASE ${quoteIdentifier(targetDatabase)}`);
    console.log(`Created database: ${targetDatabase}`);
  }
  await client.end();
}

async function applySchema() {
  const client = new Client({ ...connection, database: targetDatabase });
  await client.connect();
  for (const filePath of sqlFiles) {
    if (!fs.existsSync(filePath)) {
      console.log(`SQL file not found, skipping: ${filePath}`);
      continue;
    }
    console.log(`Applying SQL file: ${filePath}`);
    await client.query(fs.readFileSync(filePath, 'utf8'));
  }
  await client.end();
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function assertTestDatabase(database) {
  if (/test|ci/i.test(database)) return;
  if (process.env.PAYROLL_API_ALLOW_SHARED_DB === 'true') return;
  throw new Error(`Refusing to prepare non-test database "${database}". Use a name containing test/ci or set PAYROLL_API_ALLOW_SHARED_DB=true.`);
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

run().catch((error) => {
  console.error('Payroll API test database setup failed.');
  console.error(error);
  process.exit(1);
});
