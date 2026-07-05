BEGIN;

DELETE FROM payroll_details
WHERE payroll_id IN (
  SELECT p.id
  FROM payrolls p
  JOIN employees e ON e.id = p.employee_id
  WHERE e.matricule IN ('EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-005')
);

DELETE FROM payrolls
WHERE employee_id IN (
  SELECT id FROM employees
  WHERE matricule IN ('EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-005')
);

DELETE FROM leave_requests
WHERE employee_id IN (
  SELECT id FROM employees
  WHERE matricule IN ('EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-005')
);

DELETE FROM contracts
WHERE employee_id IN (
  SELECT id FROM employees
  WHERE matricule IN ('EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-005')
);

DELETE FROM time_clock_events
WHERE employee_id IN (
  SELECT id FROM employees
  WHERE matricule IN ('EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-005')
);

DELETE FROM time_attendance_days
WHERE employee_id IN (
  SELECT id FROM employees
  WHERE matricule IN ('EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-005')
);

DELETE FROM currency_settings
WHERE company_id IN (
  SELECT id FROM companies
  WHERE name = 'SmartHR Demo SARL'
);

DELETE FROM employees
WHERE matricule IN ('EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-005');

DELETE FROM companies
WHERE name = 'SmartHR Demo SARL';

WITH company AS (
  INSERT INTO companies (name, rccm, id_nat, tax_number, address, phone, email, is_active)
  VALUES (
    'SmartHR Demo SARL',
    'RCCM/CD/KIN/2026/D001',
    'IDNAT-DEMO-001',
    'A0700001Z',
    'Boulevard du 30 Juin, Gombe, Kinshasa',
    '+243 900 000 001',
    'contact@smarthr-demo.cd',
    true
  )
  RETURNING id
), employees_seed AS (
  INSERT INTO employees (
    matricule, last_name, first_name, birth_date, nationality, gender, address, phone, email,
    department, position, base_salary, status, company_id
  )
  SELECT *
  FROM (
    VALUES
      ('EMP-001', 'Mbuyi', 'Aline', DATE '1990-04-12', 'Congolaise', 'F', 'Gombe, Kinshasa', '+243 900 100 001', 'aline.mbuyi@smarthr-demo.cd', 'Ressources Humaines', 'Responsable RH', 2500.00, 'active'),
      ('EMP-002', 'Kalala', 'Patrick', DATE '1987-09-22', 'Congolaise', 'M', 'Limete, Kinshasa', '+243 900 100 002', 'patrick.kalala@smarthr-demo.cd', 'Finance', 'Comptable Senior', 2200.00, 'active'),
      ('EMP-003', 'Tshibangu', 'Sarah', DATE '1994-01-08', 'Congolaise', 'F', 'Ngaliema, Kinshasa', '+243 900 100 003', 'sarah.tshibangu@smarthr-demo.cd', 'Operations', 'Coordinatrice Operations', 1800.00, 'active'),
      ('EMP-004', 'Kabasele', 'Joel', DATE '1992-07-30', 'Congolaise', 'M', 'Kintambo, Kinshasa', '+243 900 100 004', 'joel.kabasele@smarthr-demo.cd', 'IT', 'Developpeur Fullstack', 2000.00, 'active'),
      ('EMP-005', 'Lukusa', 'Nadia', DATE '1996-11-15', 'Congolaise', 'F', 'Lingwala, Kinshasa', '+243 900 100 005', 'nadia.lukusa@smarthr-demo.cd', 'Commercial', 'Chargee Clientele', 1500.00, 'active')
  ) AS e(matricule, last_name, first_name, birth_date, nationality, gender, address, phone, email, department, position, base_salary, status)
  CROSS JOIN company
  ON CONFLICT (matricule) DO UPDATE SET
    last_name = EXCLUDED.last_name,
    first_name = EXCLUDED.first_name,
    email = EXCLUDED.email,
    department = EXCLUDED.department,
    position = EXCLUDED.position,
    base_salary = EXCLUDED.base_salary,
    status = EXCLUDED.status,
    company_id = EXCLUDED.company_id,
    updated_at = now()
  RETURNING id, matricule, base_salary, company_id
), all_demo_employees AS (
  SELECT id, matricule, base_salary, company_id
  FROM employees
  WHERE matricule IN ('EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-005')
), contracts_seed AS (
  INSERT INTO contracts (employee_id, type, start_date, salary, status, notes)
  SELECT id, 'CDI', DATE '2025-01-01', base_salary, 'active', 'Contrat de demonstration'
  FROM all_demo_employees
  ON CONFLICT DO NOTHING
), leave_seed AS (
  INSERT INTO leave_requests (employee_id, type, start_date, end_date, reason, status, days, approved_by)
  SELECT e.id, v.type, v.start_date, v.end_date, v.reason, v.status, v.days, u.id
  FROM all_demo_employees e
  JOIN (
    VALUES
      ('EMP-001', 'annual', DATE '2026-07-06', DATE '2026-07-10', 'Conge annuel planifie', 'approved', 5),
      ('EMP-002', 'sick', DATE '2026-06-18', DATE '2026-06-19', 'Repos medical', 'approved', 2),
      ('EMP-003', 'annual', DATE '2026-08-03', DATE '2026-08-07', 'Conge familial', 'pending', 5),
      ('EMP-005', 'other', DATE '2026-06-25', DATE '2026-06-25', 'Rendez-vous administratif', 'pending', 1)
  ) AS v(matricule, type, start_date, end_date, reason, status, days) ON v.matricule = e.matricule
  LEFT JOIN users u ON u.email = 'admin@smarthr.com'
  ON CONFLICT DO NOTHING
), payroll_seed AS (
  INSERT INTO payrolls (
    employee_id, month, year, base_salary, total_allowances, total_deductions,
    gross_salary, taxable_salary, net_fiscal, employer_contributions, net_salary,
    currency, exchange_rate, workflow_step, status, calculation_snapshot
  )
  SELECT
    id,
    6,
    2026,
    base_salary,
    150.00,
    ROUND(base_salary * 0.12, 2),
    base_salary + 150.00,
    base_salary + 150.00,
    ROUND((base_salary + 150.00) - (base_salary * 0.12), 2),
    ROUND(base_salary * 0.09, 2),
    ROUND((base_salary + 150.00) - (base_salary * 0.12), 2),
    'USD',
    2850.0000,
    'validated',
    'validated',
    jsonb_build_object('source', 'demo_seed', 'period', '2026-06')
  FROM all_demo_employees
  ON CONFLICT (employee_id, month, year) DO UPDATE SET
    base_salary = EXCLUDED.base_salary,
    total_allowances = EXCLUDED.total_allowances,
    total_deductions = EXCLUDED.total_deductions,
    gross_salary = EXCLUDED.gross_salary,
    taxable_salary = EXCLUDED.taxable_salary,
    net_fiscal = EXCLUDED.net_fiscal,
    employer_contributions = EXCLUDED.employer_contributions,
    net_salary = EXCLUDED.net_salary,
    currency = EXCLUDED.currency,
    workflow_step = EXCLUDED.workflow_step,
    status = EXCLUDED.status,
    calculation_snapshot = EXCLUDED.calculation_snapshot,
    updated_at = now()
  RETURNING id, employee_id, base_salary
)
INSERT INTO payroll_details (payroll_id, label, code, category, type, base_amount, amount, rate, metadata)
SELECT id, 'Prime de transport', 'TRANSPORT', 'allowance', 'allowance', base_salary, 150.00, NULL, '{"source":"demo_seed"}'::jsonb
FROM payroll_seed
UNION ALL
SELECT id, 'Retenue sociale', 'SOCIAL', 'deduction', 'deduction', base_salary, ROUND(base_salary * 0.12, 2), 12.00, '{"source":"demo_seed"}'::jsonb
FROM payroll_seed
ON CONFLICT DO NOTHING;

INSERT INTO contracts (employee_id, type, start_date, salary, status, notes)
SELECT e.id, 'CDI', DATE '2025-01-01', e.base_salary, 'active', 'Contrat de demonstration'
FROM employees e
WHERE e.matricule IN ('EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-005')
  AND NOT EXISTS (
    SELECT 1 FROM contracts c
    WHERE c.employee_id = e.id
      AND c.start_date = DATE '2025-01-01'
      AND c.type = 'CDI'
  );

INSERT INTO leave_requests (employee_id, type, start_date, end_date, reason, status, days, approved_by)
SELECT e.id, v.type, v.start_date, v.end_date, v.reason, v.status, v.days, u.id
FROM employees e
JOIN (
  VALUES
    ('EMP-001', 'annual', DATE '2026-07-06', DATE '2026-07-10', 'Conge annuel planifie', 'approved', 5),
    ('EMP-002', 'sick', DATE '2026-06-18', DATE '2026-06-19', 'Repos medical', 'approved', 2),
    ('EMP-003', 'annual', DATE '2026-08-03', DATE '2026-08-07', 'Conge familial', 'pending', 5),
    ('EMP-005', 'other', DATE '2026-06-25', DATE '2026-06-25', 'Rendez-vous administratif', 'pending', 1)
) AS v(matricule, type, start_date, end_date, reason, status, days) ON v.matricule = e.matricule
LEFT JOIN users u ON u.email = 'admin@smarthr.com'
WHERE NOT EXISTS (
  SELECT 1 FROM leave_requests lr
  WHERE lr.employee_id = e.id
    AND lr.start_date = v.start_date
    AND lr.end_date = v.end_date
    AND lr.type = v.type
);

WITH demo_payrolls AS (
  INSERT INTO payrolls (
    employee_id, month, year, base_salary, total_allowances, total_deductions,
    gross_salary, taxable_salary, net_fiscal, employer_contributions, net_salary,
    currency, exchange_rate, workflow_step, status, calculation_snapshot
  )
  SELECT
    id,
    6,
    2026,
    base_salary,
    150.00,
    ROUND(base_salary * 0.12, 2),
    base_salary + 150.00,
    base_salary + 150.00,
    ROUND((base_salary + 150.00) - (base_salary * 0.12), 2),
    ROUND(base_salary * 0.09, 2),
    ROUND((base_salary + 150.00) - (base_salary * 0.12), 2),
    'USD',
    2850.0000,
    'validated',
    'validated',
    jsonb_build_object('source', 'demo_seed', 'period', '2026-06')
  FROM employees
  WHERE matricule IN ('EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-005')
  ON CONFLICT (employee_id, month, year) DO UPDATE SET
    base_salary = EXCLUDED.base_salary,
    total_allowances = EXCLUDED.total_allowances,
    total_deductions = EXCLUDED.total_deductions,
    gross_salary = EXCLUDED.gross_salary,
    taxable_salary = EXCLUDED.taxable_salary,
    net_fiscal = EXCLUDED.net_fiscal,
    employer_contributions = EXCLUDED.employer_contributions,
    net_salary = EXCLUDED.net_salary,
    currency = EXCLUDED.currency,
    workflow_step = EXCLUDED.workflow_step,
    status = EXCLUDED.status,
    calculation_snapshot = EXCLUDED.calculation_snapshot,
    updated_at = now()
  RETURNING id, base_salary
)
INSERT INTO payroll_details (payroll_id, label, code, category, type, base_amount, amount, rate, metadata)
SELECT id, 'Prime de transport', 'TRANSPORT', 'allowance', 'allowance', base_salary, 150.00, NULL, '{"source":"demo_seed"}'::jsonb
FROM demo_payrolls
WHERE NOT EXISTS (
  SELECT 1 FROM payroll_details pd
  WHERE pd.payroll_id = demo_payrolls.id AND pd.code = 'TRANSPORT'
)
UNION ALL
SELECT id, 'Retenue sociale', 'SOCIAL', 'deduction', 'deduction', base_salary, ROUND(base_salary * 0.12, 2), 12.00, '{"source":"demo_seed"}'::jsonb
FROM demo_payrolls
WHERE NOT EXISTS (
  SELECT 1 FROM payroll_details pd
  WHERE pd.payroll_id = demo_payrolls.id AND pd.code = 'SOCIAL'
);

INSERT INTO time_clock_events (company_id, employee_id, event_type, event_time, method, source, location_label, created_by)
SELECT e.company_id, e.id, v.event_type, v.event_time, 'manual', 'demo_seed', 'Siege Kinshasa', u.id
FROM employees e
JOIN (
  VALUES
    ('EMP-001', 'entry', TIMESTAMP '2026-06-22 08:02:00'),
    ('EMP-001', 'exit',  TIMESTAMP '2026-06-22 17:05:00'),
    ('EMP-002', 'entry', TIMESTAMP '2026-06-22 08:20:00'),
    ('EMP-002', 'exit',  TIMESTAMP '2026-06-22 17:00:00'),
    ('EMP-003', 'entry', TIMESTAMP '2026-06-22 07:55:00'),
    ('EMP-003', 'exit',  TIMESTAMP '2026-06-22 16:45:00'),
    ('EMP-004', 'entry', TIMESTAMP '2026-06-22 09:00:00'),
    ('EMP-004', 'exit',  TIMESTAMP '2026-06-22 18:15:00')
) AS v(matricule, event_type, event_time) ON v.matricule = e.matricule
LEFT JOIN users u ON u.email = 'admin@smarthr.com'
ON CONFLICT DO NOTHING;

INSERT INTO time_attendance_days (
  company_id, employee_id, work_date, expected_minutes, worked_minutes, normal_minutes,
  overtime_minutes, late_minutes, presence_status, workflow_status, calculation_snapshot, created_by
)
SELECT e.company_id, e.id, DATE '2026-06-22', 480, v.worked_minutes, LEAST(v.worked_minutes, 480),
       GREATEST(v.worked_minutes - 480, 0), v.late_minutes, v.presence_status, 'approved',
       jsonb_build_object('source', 'demo_seed'), u.id
FROM employees e
JOIN (
  VALUES
    ('EMP-001', 543, 2, 'present'),
    ('EMP-002', 520, 20, 'late'),
    ('EMP-003', 530, 0, 'present'),
    ('EMP-004', 555, 60, 'late'),
    ('EMP-005', 0, 0, 'absent')
) AS v(matricule, worked_minutes, late_minutes, presence_status) ON v.matricule = e.matricule
LEFT JOIN users u ON u.email = 'admin@smarthr.com'
ON CONFLICT (employee_id, work_date) DO UPDATE SET
  worked_minutes = EXCLUDED.worked_minutes,
  normal_minutes = EXCLUDED.normal_minutes,
  overtime_minutes = EXCLUDED.overtime_minutes,
  late_minutes = EXCLUDED.late_minutes,
  presence_status = EXCLUDED.presence_status,
  workflow_status = EXCLUDED.workflow_status,
  calculation_snapshot = EXCLUDED.calculation_snapshot,
  updated_at = now();

INSERT INTO currency_settings (company_id, primary_currency, secondary_currency, usd_to_cdf_rate, rate_source, updated_at)
SELECT id, 'USD', 'CDF', 2850.0000, 'manual', now()
FROM companies
WHERE name = 'SmartHR Demo SARL'
ON CONFLICT (company_id) DO UPDATE SET
  primary_currency = EXCLUDED.primary_currency,
  secondary_currency = EXCLUDED.secondary_currency,
  usd_to_cdf_rate = EXCLUDED.usd_to_cdf_rate,
  rate_source = EXCLUDED.rate_source,
  updated_at = now();

COMMIT;
