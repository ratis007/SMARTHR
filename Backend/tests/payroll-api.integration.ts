import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api';
const MONTH = Number(process.env.PAYROLL_API_TEST_MONTH || 10);
const YEAR = Number(process.env.PAYROLL_API_TEST_YEAR || 2099);
const EMPLOYEE_ID = Number(process.env.PAYROLL_API_TEST_EMPLOYEE_ID || 32);
const TEST_CODE = `TEST_API_${Date.now()}`;

loadEnv();

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
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

async function cleanup() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'smarthr_db',
  });
  await client.connect();
  await client.query(`
    DELETE FROM payroll_details
    WHERE payroll_id IN (
      SELECT id FROM payrolls WHERE employee_id = $1 AND month = $2 AND year = $3
    )
  `, [EMPLOYEE_ID, MONTH, YEAR]);
  await client.query('DELETE FROM payrolls WHERE employee_id = $1 AND month = $2 AND year = $3', [EMPLOYEE_ID, MONTH, YEAR]);
  await client.query('DELETE FROM payroll_variable_inputs WHERE code = $1 AND month = $2 AND year = $3', [TEST_CODE, MONTH, YEAR]);
  await client.query('DELETE FROM payroll_time_inputs WHERE notes = $1 AND month = $2 AND year = $3', [TEST_CODE, MONTH, YEAR]);
  await client.query('DELETE FROM payroll_periods WHERE month = $1 AND year = $2 AND reason LIKE $3', [MONTH, YEAR, `${TEST_CODE}%`]);
  await client.query('DELETE FROM audit_logs WHERE details::text LIKE $1', [`%${TEST_CODE}%`]);
  await client.end();
}

async function run() {
  await cleanup();
  const token = await login();

  const employeeResult = await api(`/employees/${EMPLOYEE_ID}`, { headers: authHeaders(token) });
  assert.strictEqual(employeeResult.response.status, 200);
  const employee = employeeResult.body;
  const companyId = Number(employee.companyId || 6);
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

  const generated = await api('/payroll/generate', {
    method: 'POST',
    headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ employeeId: EMPLOYEE_ID, month: MONTH, year: YEAR }),
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
    body: JSON.stringify({ employeeId: EMPLOYEE_ID, month: MONTH, year: YEAR }),
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
