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
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  file_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

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
  net_salary DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'paid')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (employee_id, month, year)
);

CREATE TABLE IF NOT EXISTS payroll_details (
  id SERIAL PRIMARY KEY,
  payroll_id INT REFERENCES payrolls(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  type VARCHAR(20) CHECK (type IN ('allowance', 'deduction')),
  amount DECIMAL(15, 2) NOT NULL,
  rate DECIMAL(5, 2)
);

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
  type VARCHAR(20) CHECK (type IN ('annual', 'sick', 'maternity', 'unpaid', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
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
  ('leave:read', 'leave'), ('leave:write', 'leave'), ('leave:approve', 'leave'),
  ('companies:read', 'companies'), ('companies:write', 'companies'),
  ('reports:read', 'reports')
ON CONFLICT (name) DO NOTHING;
