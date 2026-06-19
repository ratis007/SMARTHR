-- SmartHR Payroll Enterprise Engine upgrade

CREATE TABLE IF NOT EXISTS payroll_rubrics (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  label VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  calculation_type VARCHAR(50) NOT NULL DEFAULT 'fixed_amount',
  value DECIMAL(15, 4) DEFAULT 0,
  is_taxable BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  is_required BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 100,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS payroll_legal_rates (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  contribution_code VARCHAR(50) NOT NULL,
  label VARCHAR(255) NOT NULL,
  employee_rate DECIMAL(8, 4) DEFAULT 0,
  employer_rate DECIMAL(8, 4) DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to DATE,
  version INT DEFAULT 1,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_ipr_brackets (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  min_amount DECIMAL(15, 2) NOT NULL,
  max_amount DECIMAL(15, 2),
  rate DECIMAL(8, 4) NOT NULL,
  fixed_amount DECIMAL(15, 2) DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to DATE,
  version INT DEFAULT 1,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_generation_jobs (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE SET NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  total_count INT DEFAULT 0,
  processed_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  requested_by INT REFERENCES users(id),
  errors JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_variable_inputs (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  month INT NOT NULL,
  year INT NOT NULL,
  code VARCHAR(80) NOT NULL,
  label VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('allowance', 'deduction')),
  category VARCHAR(50),
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'CDF',
  taxable BOOLEAN DEFAULT TRUE,
  source VARCHAR(50) DEFAULT 'manual',
  status VARCHAR(20) DEFAULT 'active',
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_time_inputs (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  month INT NOT NULL,
  year INT NOT NULL,
  overtime_hours DECIMAL(10, 2) DEFAULT 0,
  night_hours DECIMAL(10, 2) DEFAULT 0,
  sunday_hours DECIMAL(10, 2) DEFAULT 0,
  holiday_hours DECIMAL(10, 2) DEFAULT 0,
  unpaid_absence_days DECIMAL(10, 2) DEFAULT 0,
  late_minutes INT DEFAULT 0,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_periods (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  month INT NOT NULL,
  year INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  closed_by INT REFERENCES users(id),
  closed_at TIMESTAMP,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, month, year)
);

CREATE TABLE IF NOT EXISTS payroll_documents (
  id SERIAL PRIMARY KEY,
  payroll_id INT REFERENCES payrolls(id) ON DELETE CASCADE,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  company_id INT REFERENCES companies(id) ON DELETE SET NULL,
  document_type VARCHAR(50) NOT NULL DEFAULT 'payslip',
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT DEFAULT 0,
  mime_type VARCHAR(150),
  checksum VARCHAR(128) NOT NULL,
  signature_status VARCHAR(30) NOT NULL DEFAULT 'signed',
  signed_by INT REFERENCES users(id) ON DELETE SET NULL,
  signed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS gross_salary DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS taxable_salary DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS net_fiscal DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS employer_contributions DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'CDF';
ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(15, 4) DEFAULT 1;
ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS workflow_step VARCHAR(30) DEFAULT 'draft';
ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS calculation_snapshot JSONB;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payrolls_status_enum') THEN
    ALTER TYPE payrolls_status_enum ADD VALUE IF NOT EXISTS 'preparation';
    ALTER TYPE payrolls_status_enum ADD VALUE IF NOT EXISTS 'review';
    ALTER TYPE payrolls_status_enum ADD VALUE IF NOT EXISTS 'closed';
  END IF;
END $$;

ALTER TABLE payroll_details ADD COLUMN IF NOT EXISTS code VARCHAR(80);
ALTER TABLE payroll_details ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE payroll_details ADD COLUMN IF NOT EXISTS base_amount DECIMAL(15, 2);
ALTER TABLE payroll_details ADD COLUMN IF NOT EXISTS employer_amount DECIMAL(15, 2) DEFAULT 0;
ALTER TABLE payroll_details ADD COLUMN IF NOT EXISTS metadata JSONB;

INSERT INTO payroll_legal_rates (contribution_code, label, employee_rate, employer_rate, effective_from, version)
SELECT *
FROM (VALUES
  ('CNSS', 'Caisse Nationale de Securite Sociale', 5::decimal, 13::decimal, '2026-01-01'::date, 1),
  ('INPP', 'Institut National de Preparation Professionnelle', 0::decimal, 1::decimal, '2026-01-01'::date, 1),
  ('ONEM', 'Office National de l''Emploi', 0::decimal, 0.2::decimal, '2026-01-01'::date, 1)
) AS seed(contribution_code, label, employee_rate, employer_rate, effective_from, version)
WHERE NOT EXISTS (
  SELECT 1 FROM payroll_legal_rates r
  WHERE r.company_id IS NULL
    AND r.contribution_code = seed.contribution_code
    AND r.effective_from = seed.effective_from
    AND r.version = seed.version
);

INSERT INTO payroll_ipr_brackets (min_amount, max_amount, rate, effective_from, version)
SELECT 0, NULL, 15, '2026-01-01', 1
WHERE NOT EXISTS (
  SELECT 1 FROM payroll_ipr_brackets b
  WHERE b.company_id IS NULL
    AND b.min_amount = 0
    AND b.max_amount IS NULL
    AND b.effective_from = '2026-01-01'
    AND b.version = 1
);

INSERT INTO payroll_rubrics (code, label, category, calculation_type, value, is_taxable, is_active, is_required, sort_order)
SELECT *
FROM (VALUES
  ('ANCIENNETE', 'Indemnite anciennete', 'indemnity', 'percent_of_base', 0::decimal, true, false, false, 40),
  ('TRANSPORT', 'Indemnite transport', 'indemnity', 'fixed_amount', 0::decimal, false, false, false, 50),
  ('LOGEMENT', 'Indemnite logement', 'benefit', 'fixed_amount', 0::decimal, true, false, false, 60)
) AS seed(code, label, category, calculation_type, value, is_taxable, is_active, is_required, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM payroll_rubrics r
  WHERE r.company_id IS NULL AND r.code = seed.code
);

CREATE INDEX IF NOT EXISTS idx_payrolls_period ON payrolls(year, month);
CREATE INDEX IF NOT EXISTS idx_payroll_details_payroll_id ON payroll_details(payroll_id);
CREATE INDEX IF NOT EXISTS idx_payroll_rates_effective ON payroll_legal_rates(contribution_code, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_payroll_generation_jobs_status ON payroll_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_payroll_variable_inputs_period ON payroll_variable_inputs(employee_id, year, month, status);
CREATE INDEX IF NOT EXISTS idx_payroll_time_inputs_period ON payroll_time_inputs(employee_id, year, month, status);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_company_period ON payroll_periods(company_id, year, month, status);
CREATE INDEX IF NOT EXISTS idx_payroll_documents_payroll_id ON payroll_documents(payroll_id);
CREATE INDEX IF NOT EXISTS idx_payroll_documents_employee_id ON payroll_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_documents_checksum ON payroll_documents(checksum);

INSERT INTO permissions (name, module) VALUES
  ('payroll:generate', 'payroll'),
  ('payroll:update', 'payroll'),
  ('payroll:validate', 'payroll'),
  ('payroll:close', 'payroll'),
  ('payroll:export', 'payroll'),
  ('payroll:configure', 'payroll'),
  ('payroll:input', 'payroll'),
  ('payroll:import', 'payroll')
ON CONFLICT (name) DO NOTHING;
