-- SmartHR & Payroll - Schéma PostgreSQL
-- Application RH & Paie Multi-Entreprise

-- ============================================================
-- MODULE ADMINISTRATION
-- ============================================================

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  module VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  role_id INT REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100),
  entity_id INT,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- MODULE MULTI-ENTREPRISE
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  rccm VARCHAR(100),
  id_nat VARCHAR(100),
  tax_number VARCHAR(100),
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  logo VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sites (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_settings (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  setting_type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  description TEXT,
  config JSONB,
  is_required BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS currency_settings (
  id SERIAL PRIMARY KEY,
  company_id INT UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  primary_currency VARCHAR(3) DEFAULT 'CDF' CHECK (primary_currency IN ('CDF', 'USD')),
  secondary_currency VARCHAR(3) DEFAULT 'USD' CHECK (secondary_currency IN ('CDF', 'USD')),
  usd_to_cdf_rate DECIMAL(15, 4) DEFAULT 2850,
  rate_source VARCHAR(20) DEFAULT 'manual' CHECK (rate_source IN ('manual', 'api')),
  rounding_mode VARCHAR(20) DEFAULT 'nearest' CHECK (rounding_mode IN ('nearest', 'up', 'down')),
  rounding_precision INT DEFAULT 2,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exchange_rate_history (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(15, 4) NOT NULL,
  source VARCHAR(20) DEFAULT 'manual',
  effective_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- MODULE GESTION DU PERSONNEL
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  department_id INT REFERENCES departments(id),
  title VARCHAR(255) NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  matricule VARCHAR(20) UNIQUE NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  first_name VARCHAR(100) NOT NULL,
  birth_date DATE,
  nationality VARCHAR(100),
  gender CHAR(1) CHECK (gender IN ('M', 'F')),
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  department VARCHAR(100),
  position VARCHAR(100),
  base_salary DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  company_id INT REFERENCES companies(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employee_documents (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  document_type VARCHAR(50) DEFAULT 'other' CHECK (document_type IN ('contract', 'diploma', 'id_card', 'cv', 'other')),
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT DEFAULT 0,
  mime_type VARCHAR(150),
  uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) DEFAULT 'other';
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(150);
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS uploaded_by INT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_documents' AND column_name = 'name'
  ) THEN
    UPDATE employee_documents SET file_name = COALESCE(file_name, name, 'document') WHERE file_name IS NULL;
  ELSE
    UPDATE employee_documents SET file_name = COALESCE(file_name, 'document') WHERE file_name IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_documents' AND column_name = 'type'
  ) THEN
    UPDATE employee_documents SET document_type = COALESCE(document_type, type, 'other') WHERE document_type IS NULL;
  ELSE
    UPDATE employee_documents SET document_type = COALESCE(document_type, 'other') WHERE document_type IS NULL;
  END IF;
END $$;

-- ============================================================
-- MODULE CONTRATS
-- ============================================================

CREATE TABLE IF NOT EXISTS contracts (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  type VARCHAR(20) CHECK (type IN ('CDI', 'CDD', 'STAGE', 'CONSULTANT')),
  start_date DATE NOT NULL,
  end_date DATE,
  salary DECIMAL(15, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- MODULE PAIE
-- ============================================================

CREATE TABLE IF NOT EXISTS payroll_items (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id),
  label VARCHAR(255) NOT NULL,
  type VARCHAR(20) CHECK (type IN ('allowance', 'deduction')),
  calculation_type VARCHAR(20) CHECK (calculation_type IN ('fixed', 'percentage')),
  value DECIMAL(10, 4) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS payrolls (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL,
  base_salary DECIMAL(15, 2) DEFAULT 0,
  total_allowances DECIMAL(15, 2) DEFAULT 0,
  total_deductions DECIMAL(15, 2) DEFAULT 0,
  gross_salary DECIMAL(15, 2) DEFAULT 0,
  taxable_salary DECIMAL(15, 2) DEFAULT 0,
  net_fiscal DECIMAL(15, 2) DEFAULT 0,
  employer_contributions DECIMAL(15, 2) DEFAULT 0,
  net_salary DECIMAL(15, 2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'CDF',
  exchange_rate DECIMAL(15, 4) DEFAULT 1,
  workflow_step VARCHAR(30) DEFAULT 'draft',
  calculation_snapshot JSONB,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'preparation', 'review', 'validated', 'closed', 'paid', 'archived')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (employee_id, month, year)
);

CREATE TABLE IF NOT EXISTS payroll_details (
  id SERIAL PRIMARY KEY,
  payroll_id INT REFERENCES payrolls(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  code VARCHAR(80),
  category VARCHAR(50),
  type VARCHAR(20) CHECK (type IN ('allowance', 'deduction')),
  base_amount DECIMAL(15, 2),
  amount DECIMAL(15, 2) NOT NULL,
  employer_amount DECIMAL(15, 2) DEFAULT 0,
  rate DECIMAL(5, 2),
  metadata JSONB
);

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

CREATE TABLE IF NOT EXISTS deductions (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id),
  label VARCHAR(255) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  month INT,
  year INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loans (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id),
  amount DECIMAL(15, 2) NOT NULL,
  monthly_deduction DECIMAL(15, 2) NOT NULL,
  remaining_amount DECIMAL(15, 2),
  start_date DATE,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- MODULE CONGÉS
-- ============================================================

CREATE TABLE IF NOT EXISTS leave_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  days_per_year INT DEFAULT 0,
  is_paid BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  type VARCHAR(20) CHECK (type IN ('annual', 'sick', 'maternity', 'paternity', 'unpaid', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  days INT,
  approved_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leave_balances (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id),
  leave_type_id INT REFERENCES leave_types(id),
  year INT NOT NULL,
  total_days INT DEFAULT 0,
  used_days INT DEFAULT 0,
  remaining_days INT GENERATED ALWAYS AS (total_days - used_days) STORED
);

-- ============================================================
-- MODULE CONFLITS & DISCIPLINE
-- ============================================================

CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id),
  description TEXT NOT NULL,
  date DATE NOT NULL,
  severity VARCHAR(20) CHECK (severity IN ('minor', 'major', 'critical')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disciplinary_actions (
  id SERIAL PRIMARY KEY,
  incident_id INT REFERENCES incidents(id),
  employee_id INT REFERENCES employees(id),
  action_type VARCHAR(100),
  description TEXT,
  date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- MODULE RÉSILIATION
-- ============================================================

CREATE TABLE IF NOT EXISTS terminations (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id),
  reason VARCHAR(255),
  termination_date DATE NOT NULL,
  notice_period INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- MODULE GPEC
-- ============================================================

CREATE TABLE IF NOT EXISTS skills (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS employee_skills (
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  skill_id INT REFERENCES skills(id) ON DELETE CASCADE,
  level VARCHAR(20) CHECK (level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  PRIMARY KEY (employee_id, skill_id)
);

CREATE TABLE IF NOT EXISTS evaluations (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id),
  evaluator_id INT REFERENCES users(id),
  period VARCHAR(50),
  score DECIMAL(4, 2),
  comments TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- MODULE DOCUMENTS RH
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  employee_id INT REFERENCES employees(id),
  company_id INT REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  file_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- DONNÉES INITIALES
-- ============================================================

INSERT INTO roles (name, description) VALUES
  ('admin', 'Administrateur système'),
  ('rh_manager', 'Responsable RH'),
  ('accountant', 'Comptable / Paie'),
  ('employee', 'Employé standard')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, module) VALUES
  ('users:read', 'users'), ('users:write', 'users'),
  ('employees:read', 'employees'), ('employees:write', 'employees'),
  ('payroll:read', 'payroll'), ('payroll:write', 'payroll'),
  ('payroll:generate', 'payroll'), ('payroll:update', 'payroll'),
  ('payroll:validate', 'payroll'), ('payroll:close', 'payroll'),
  ('payroll:export', 'payroll'), ('payroll:configure', 'payroll'),
  ('payroll:input', 'payroll'), ('payroll:import', 'payroll'),
  ('leave:read', 'leave'), ('leave:write', 'leave'), ('leave:approve', 'leave'),
  ('companies:read', 'companies'), ('companies:write', 'companies'),
  ('reports:read', 'reports'),
  ('audit:read', 'audit'), ('audit:write', 'audit')
ON CONFLICT (name) DO NOTHING;
