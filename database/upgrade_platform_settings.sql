ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

UPDATE users SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END WHERE status IS NULL;

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
  primary_currency VARCHAR(3) DEFAULT 'CDF',
  secondary_currency VARCHAR(3) DEFAULT 'USD',
  usd_to_cdf_rate DECIMAL(15, 4) DEFAULT 2850,
  rate_source VARCHAR(20) DEFAULT 'manual',
  rounding_mode VARCHAR(20) DEFAULT 'nearest',
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

INSERT INTO roles (name, description) VALUES
  ('super_admin', 'Super Administrateur'),
  ('admin', 'Administrateur'),
  ('supervisor', 'Superviseur'),
  ('agent', 'Agent'),
  ('company', 'Entreprise'),
  ('support_tech', 'Support Technique')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, module) VALUES
  ('settings:read', 'settings'), ('settings:write', 'settings'),
  ('currency:read', 'currency'), ('currency:write', 'currency'),
  ('audit:read', 'audit'),
  ('contracts:read', 'contracts'), ('contracts:write', 'contracts')
ON CONFLICT (name) DO NOTHING;
