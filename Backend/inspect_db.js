const { Client } = require('pg');

(async () => {
  const client = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'smarthr2026', database: 'smarthr_db' });
  try {
    await client.connect();
    const payrolls = await client.query(`SELECT p.id, p.employee_id, p.month, p.year, p.net_salary, p.status, e.company_id FROM payrolls p LEFT JOIN employees e ON e.id = p.employee_id ORDER BY p.id ASC LIMIT 50`);
    console.log('PAYROLLS');
    payrolls.rows.forEach(r => console.log(r));
    const companies = await client.query('SELECT id, name FROM companies ORDER BY id ASC');
    console.log('COMPANIES');
    companies.rows.forEach(r => console.log(r));
  } catch (e) {
    console.error('ERROR', e);
  } finally {
    await client.end();
  }
})();
