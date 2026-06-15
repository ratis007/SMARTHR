const { Client } = require('pg');
const client = new Client({
  host: 'localhost', port: 5432,
  user: 'postgres', password: 'smarthr2026', database: 'smarthr_db'
});

client.connect().then(async () => {
  // Colonnes leave_requests
  const cols = await client.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='leave_requests' ORDER BY ordinal_position"
  );
  console.log('=== leave_requests columns ===');
  cols.rows.forEach(r => console.log(' ', r.column_name, '-', r.data_type));

  // Enums liés aux congés
  const enums = await client.query(
    "SELECT t.typname, enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid ORDER BY t.typname, enumsortorder"
  );
  console.log('\n=== All enums ===');
  enums.rows.forEach(r => console.log(' ', r.typname, ':', r.enumlabel));

  // Comptage des enregistrements
  const counts = await client.query(
    'SELECT ' +
    '(SELECT COUNT(*) FROM employees) AS emp, ' +
    '(SELECT COUNT(*) FROM leave_requests) AS leaves, ' +
    '(SELECT COUNT(*) FROM contracts) AS contracts, ' +
    '(SELECT COUNT(*) FROM payrolls) AS payrolls, ' +
    '(SELECT COUNT(*) FROM companies) AS companies'
  );
  console.log('\n=== Record counts ===');
  console.log(' ', counts.rows[0]);

  // Données employees
  const emps = await client.query('SELECT id, matricule, last_name, first_name, company_id, status FROM employees ORDER BY id');
  console.log('\n=== Employees ===');
  emps.rows.forEach(r => console.log(' ', r.id, r.matricule, r.last_name, r.first_name, '| company:', r.company_id, '| status:', r.status));

  // Données contracts
  const contracts = await client.query('SELECT id, employee_id, type, status, salary FROM contracts ORDER BY id');
  console.log('\n=== Contracts ===');
  contracts.rows.forEach(r => console.log(' ', r.id, '| emp:', r.employee_id, '| type:', r.type, '| status:', r.status, '| salary:', r.salary));

  // Données leave_requests
  const leaves = await client.query('SELECT id, employee_id, type, status, start_date, end_date FROM leave_requests ORDER BY id');
  console.log('\n=== Leave requests ===');
  leaves.rows.forEach(r => console.log(' ', r.id, '| emp:', r.employee_id, '| type:', r.type, '| status:', r.status));

  // Données payrolls
  const payrolls = await client.query('SELECT id, employee_id, month, year, net_salary, status FROM payrolls ORDER BY id');
  console.log('\n=== Payrolls ===');
  payrolls.rows.forEach(r => console.log(' ', r.id, '| emp:', r.employee_id, '| month:', r.month, '/', r.year, '| net:', r.net_salary, '| status:', r.status));

  await client.end();
}).catch(e => console.error('DB Error:', e.message));
