import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import * as ExcelJS from 'exceljs';

const hasExplicitDatabase = Boolean(process.env.DB_NAME || process.env.DATABASE_URL);
loadEnv(path.join(__dirname, '..', '.env.test'));
loadEnv(path.join(__dirname, '..', '.env'));
if (!hasExplicitDatabase && !process.env.DATABASE_URL) {
  process.env.DB_NAME = process.env.PAYROLL_API_TEST_DB_NAME || 'smarthr_test';
}

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api';
const MONTH = Number(process.env.PAYROLL_API_TEST_MONTH || 10);
const YEAR = Number(process.env.PAYROLL_API_TEST_YEAR || 2099);
const TEST_CODE = `TEST_API_${Date.now()}`;
const TEST_EMAIL = `${TEST_CODE.toLowerCase()}@example.test`;
const TEST_MATRICULE = `T${Date.now().toString().slice(-12)}`;
let testEmployeeId = 0;
let testCompanyId = 0;

function loadEnv(envPath: string) {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

async function api(pathname: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, options);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, body };
}

async function apiBinary(pathname: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${pathname}`, options);
  const body = Buffer.from(await response.arrayBuffer());
  return { response, body };
}

function authHeaders(token: string, extra: Record<string, string> = {}) {
  return { Authorization: `Bearer ${token}`, ...extra };
}

async function login() {
  const { response, body } = await api('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SMARTHR_TEST_EMAIL || 'admin@smarthr.com',
      password: process.env.SMARTHR_TEST_PASSWORD || 'SmartHR@2026',
    }),
  });
  assert.strictEqual(response.status, 201);
  assert.ok(body.access_token, 'access_token manquant');
  return body.access_token as string;
}

async function importCsv(token: string, endpoint: string, csv: string, companyId: number) {
  const form = new FormData();
  form.append('file', new Blob([csv], { type: 'text/csv' }), 'payroll-test.csv');
  const { response, body } = await api(`${endpoint}?companyId=${companyId}&month=${MONTH}&year=${YEAR}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
  });
  assert.strictEqual(response.status, 201, JSON.stringify(body));
  assert.strictEqual(body.success, 1, JSON.stringify(body));
  assert.strictEqual(body.failed, 0, JSON.stringify(body));
  return body;
}

async function importExcel(token: string, endpoint: string, rows: any[][], companyId: number) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Pointage');
  rows.forEach((row) => sheet.addRow(row));
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'payroll-time-test.xlsx');
  const { response, body } = await api(`${endpoint}?companyId=${companyId}&month=${MONTH}&year=${YEAR}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
  });
  assert.strictEqual(response.status, 201, JSON.stringify(body));
  assert.strictEqual(body.success, 1, JSON.stringify(body));
  assert.strictEqual(body.failed, 0, JSON.stringify(body));
  return body;
}

async function cleanup() {
  const client = createDbClient();
  await client.connect();
  await assertSafeDatabase(client);
  await client.query(`
    DELETE FROM payroll_details
    WHERE payroll_id IN (
      SELECT p.id FROM payrolls p
      JOIN employees e ON e.id = p.employee_id
      WHERE e.matricule = $1 OR e.email = $2
    )
  `, [TEST_MATRICULE, TEST_EMAIL]);
  await client.query(`
    DELETE FROM payrolls
    WHERE employee_id IN (SELECT id FROM employees WHERE matricule = $1 OR email = $2)
  `, [TEST_MATRICULE, TEST_EMAIL]);
  await client.query('DELETE FROM payroll_variable_inputs WHERE code = $1 AND month = $2 AND year = $3', [TEST_CODE, MONTH, YEAR]);
  await client.query('DELETE FROM payroll_time_inputs WHERE notes = $1 AND month = $2 AND year = $3', [TEST_CODE, MONTH, YEAR]);
  await client.query('DELETE FROM payroll_periods WHERE month = $1 AND year = $2 AND reason LIKE $3', [MONTH, YEAR, `${TEST_CODE}%`]);
  await client.query('DELETE FROM audit_logs WHERE details::text LIKE $1', [`%${TEST_CODE}%`]);
  await client.query('DELETE FROM employees WHERE matricule = $1 OR email = $2', [TEST_MATRICULE, TEST_EMAIL]);
  await client.query('DELETE FROM companies WHERE name = $1', [`${TEST_CODE} Company`]);
  await client.end();
}

async function createFixture() {
  const client = createDbClient();
  await client.connect();
  await assertSafeDatabase(client);
  const company = await client.query(`
    INSERT INTO companies (name, rccm, id_nat, tax_number, address, phone, email, is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,true)
    RETURNING id
  `, [`${TEST_CODE} Company`, TEST_CODE, TEST_CODE, TEST_CODE, 'Kinshasa', '+243000000000', TEST_EMAIL]);
  testCompanyId = Number(company.rows[0].id);

  const employee = await client.query(`
    INSERT INTO employees (
      matricule, last_name, first_name, email, department, position, base_salary, status, company_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8)
    RETURNING id
  `, [TEST_MATRICULE, 'Integration', 'Payroll', TEST_EMAIL, 'QA Paie', 'Analyste Paie', 1000, testCompanyId]);
  testEmployeeId = Number(employee.rows[0].id);
  await client.end();
}

function createDbClient() {
  return new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: databaseName(),
  });
}

function databaseName() {
  if (process.env.DATABASE_URL) return new URL(process.env.DATABASE_URL).pathname.replace(/^\//, '');
  return process.env.DB_NAME || 'smarthr_db';
}

async function assertSafeDatabase(client: Client) {
  const result = await client.query('SELECT current_database() AS name');
  const name = String(result.rows[0]?.name || '');
  if (/test|ci/i.test(name) || process.env.PAYROLL_API_ALLOW_SHARED_DB === 'true') return;
  throw new Error(`Refusing to run payroll API integration test against non-test database "${name}". Use DB_NAME=smarthr_test or set PAYROLL_API_ALLOW_SHARED_DB=true.`);
}

async function run() {
  await cleanup();
  await createFixture();
  const token = await login();

  const employeeResult = await api(`/employees/${testEmployeeId}`, { headers: authHeaders(token) });
  assert.strictEqual(employeeResult.response.status, 200);
  const employee = employeeResult.body;
  const companyId = Number(employee.companyId || testCompanyId);
  assert.ok(employee.matricule, 'matricule employe manquant');

  await importCsv(
    token,
    '/payroll/variables/import-csv',
    `matricule;code;label;type;category;amount;currency;taxable\n${employee.matricule};${TEST_CODE};Prime API;allowance;variable_earning;10;CDF;oui`,
    companyId,
  );

  await importCsv(
    token,
    '/payroll/time-inputs/import-csv',
    `matricule;overtime_hours;night_hours;sunday_hours;holiday_hours;unpaid_absence_days;late_minutes;notes\n${employee.matricule};1;0;0;0;0;0;${TEST_CODE}`,
    companyId,
  );

  await importExcel(
    token,
    '/payroll/time-inputs/import-excel',
    [
      ['badge', 'heures_travaillees', 'heures_prevues', 'heure_arrivee', 'heure_prevue', 'notes'],
      [employee.matricule, 9, 8, '08:15', '08:00', TEST_CODE],
    ],
    companyId,
  );

  const generated = await api('/payroll/generate', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ employeeId: testEmployeeId, month: MONTH, year: YEAR }),
  });
  assert.strictEqual(generated.response.status, 201, JSON.stringify(generated.body));
  assert.strictEqual(generated.body.status, 'draft');
  assert.ok(Number(generated.body.netSalary) > 0);

  const workflow = await api(`/payroll/${generated.body.id}/workflow/preparation`, {
    method: 'PUT',
    headers: authHeaders(token),
  });
  assert.strictEqual(workflow.response.status, 200, JSON.stringify(workflow.body));
  assert.strictEqual(workflow.body.status, 'preparation');

  const auditTrail = await api(`/payroll/audit-trail?companyId=${companyId}&month=${MONTH}&year=${YEAR}`, {
    headers: authHeaders(token),
  });
  assert.strictEqual(auditTrail.response.status, 200, JSON.stringify(auditTrail.body));
  assert.ok(Array.isArray(auditTrail.body), 'audit-trail doit retourner un tableau');
  assert.ok(auditTrail.body.some((log: any) => log.action === 'payroll:workflow'), 'audit workflow introuvable');

  const journal = await api(`/payroll/journal/export-excel?companyId=${companyId}&month=${MONTH}&year=${YEAR}`, {
    headers: authHeaders(token),
  });
  assert.strictEqual(journal.response.status, 200);
  assert.ok(String(journal.body).includes('<Workbook'), 'journal Excel invalide');

  const book = await api(`/payroll/book/export-excel?companyId=${companyId}&month=${MONTH}&year=${YEAR}`, {
    headers: authHeaders(token),
  });
  assert.strictEqual(book.response.status, 200);
  assert.ok(String(book.body).includes('Livre de paie'), 'livre Excel invalide');

  const journalXlsx = await apiBinary(`/payroll/journal/export-xlsx?companyId=${companyId}&month=${MONTH}&year=${YEAR}`, {
    headers: authHeaders(token),
  });
  assert.strictEqual(journalXlsx.response.status, 200);
  assert.strictEqual(journalXlsx.body.subarray(0, 2).toString(), 'PK', 'journal XLSX invalide');

  const bookXlsx = await apiBinary(`/payroll/book/export-xlsx?companyId=${companyId}&month=${MONTH}&year=${YEAR}`, {
    headers: authHeaders(token),
  });
  assert.strictEqual(bookXlsx.response.status, 200);
  assert.strictEqual(bookXlsx.body.subarray(0, 2).toString(), 'PK', 'livre XLSX invalide');

  const payslipXlsx = await apiBinary(`/payroll/${generated.body.id}/payslip-excel`, {
    headers: authHeaders(token),
  });
  assert.strictEqual(payslipXlsx.response.status, 200);
  assert.strictEqual(payslipXlsx.body.subarray(0, 2).toString(), 'PK', 'bulletin XLSX invalide');

  const closePeriod = await api(`/payroll/period/close?companyId=${companyId}`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ month: MONTH, year: YEAR, reason: `${TEST_CODE} close` }),
  });
  assert.strictEqual(closePeriod.response.status, 201, JSON.stringify(closePeriod.body));
  assert.strictEqual(closePeriod.body.status, 'closed');

  const blocked = await api('/payroll/generate', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ employeeId: testEmployeeId, month: MONTH, year: YEAR }),
  });
  assert.strictEqual(blocked.response.status, 400);
  assert.ok(String(blocked.body.message).includes('cloturee'));

  const reopenPeriod = await api(`/payroll/period/reopen?companyId=${companyId}`, {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ month: MONTH, year: YEAR, reason: `${TEST_CODE} reopen` }),
  });
  assert.strictEqual(reopenPeriod.response.status, 201, JSON.stringify(reopenPeriod.body));
  assert.strictEqual(reopenPeriod.body.status, 'open');

  await cleanup();
  console.log('Payroll API integration tests passed');
}

run().catch(async (error) => {
  await cleanup().catch(() => undefined);
  console.error(error);
  process.exit(1);
});
