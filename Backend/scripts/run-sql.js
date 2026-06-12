const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const sqlFiles = [
  path.resolve(__dirname, '../../database/schema.sql'),
  path.resolve(__dirname, '../../database/upgrade_platform_settings.sql'),
];

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log('DATABASE_URL is not defined. Skipping database setup.');
    return;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
  });

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
  console.log('Database setup completed.');
}

run().catch((error) => {
  console.error('Database setup failed.');
  console.error(error);
  process.exit(1);
});
