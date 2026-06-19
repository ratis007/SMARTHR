-- SmartHR Time & Attendance Enterprise module upgrade

CREATE TABLE IF NOT EXISTS sites (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_work_profiles (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  profile_type VARCHAR(50) DEFAULT 'standard',
  weekly_hours DECIMAL(8, 2) DEFAULT 40,
  grace_late_minutes INT DEFAULT 5,
  overtime_threshold_minutes INT DEFAULT 0,
  flexible_arrival_from TIME,
  flexible_arrival_to TIME,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS time_work_profile_days (
  id SERIAL PRIMARY KEY,
  profile_id INT REFERENCES time_work_profiles(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  is_working_day BOOLEAN DEFAULT TRUE,
  start_time TIME,
  end_time TIME,
  break_start TIME,
  break_end TIME,
  expected_minutes INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS time_holidays (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_paid BOOLEAN DEFAULT TRUE,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, holiday_date)
);

CREATE TABLE IF NOT EXISTS time_shift_teams (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  site_id INT REFERENCES sites(id) ON DELETE SET NULL,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  rotation_pattern VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS time_rotation_patterns (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(255) NOT NULL,
  rotation_type VARCHAR(50) DEFAULT 'work_rest',
  work_days INT NOT NULL DEFAULT 5,
  rest_days INT NOT NULL DEFAULT 2,
  cycle_start_date DATE NOT NULL,
  day_profile_id INT REFERENCES time_work_profiles(id) ON DELETE RESTRICT,
  night_profile_id INT REFERENCES time_work_profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS time_employee_work_profile_assignments (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  profile_id INT REFERENCES time_work_profiles(id) ON DELETE CASCADE,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  department VARCHAR(100),
  position VARCHAR(100),
  team_id INT REFERENCES time_shift_teams(id) ON DELETE SET NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_clock_events (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('entry', 'exit')),
  event_time TIMESTAMP NOT NULL,
  method VARCHAR(50) DEFAULT 'manual',
  terminal_id VARCHAR(100),
  external_reference VARCHAR(160),
  location_label VARCHAR(255),
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  source VARCHAR(50) DEFAULT 'manual',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE time_clock_events ADD COLUMN IF NOT EXISTS external_reference VARCHAR(160);

CREATE TABLE IF NOT EXISTS time_attendance_days (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  profile_id INT REFERENCES time_work_profiles(id) ON DELETE SET NULL,
  expected_minutes INT DEFAULT 0,
  worked_minutes INT DEFAULT 0,
  normal_minutes INT DEFAULT 0,
  break_minutes INT DEFAULT 0,
  overtime_minutes INT DEFAULT 0,
  night_minutes INT DEFAULT 0,
  sunday_minutes INT DEFAULT 0,
  holiday_minutes INT DEFAULT 0,
  late_minutes INT DEFAULT 0,
  early_departure_minutes INT DEFAULT 0,
  unpaid_absence_minutes INT DEFAULT 0,
  presence_status VARCHAR(30) DEFAULT 'draft',
  workflow_status VARCHAR(30) DEFAULT 'draft',
  calculation_snapshot JSONB DEFAULT '{}'::jsonb,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS time_schedule_entries (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  profile_id INT REFERENCES time_work_profiles(id) ON DELETE SET NULL,
  team_id INT REFERENCES time_shift_teams(id) ON DELETE SET NULL,
  rotation_pattern_id INT REFERENCES time_rotation_patterns(id) ON DELETE SET NULL,
  shift_label VARCHAR(120),
  planned_start TIME,
  planned_end TIME,
  status VARCHAR(30) DEFAULT 'planned',
  rotation_day INT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS time_attendance_alerts (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
  attendance_day_id INT REFERENCES time_attendance_days(id) ON DELETE SET NULL,
  schedule_entry_id INT REFERENCES time_schedule_entries(id) ON DELETE SET NULL,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  alert_date DATE NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  status VARCHAR(30) DEFAULT 'open',
  metadata JSONB DEFAULT '{}'::jsonb,
  detected_at TIMESTAMP DEFAULT NOW(),
  acknowledged_by INT REFERENCES users(id),
  acknowledged_at TIMESTAMP,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, employee_id, alert_type, alert_date)
);

CREATE TABLE IF NOT EXISTS time_notification_outbox (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  alert_id INT REFERENCES time_attendance_alerts(id) ON DELETE CASCADE,
  channel VARCHAR(30) NOT NULL,
  recipient VARCHAR(255),
  subject VARCHAR(255),
  payload JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(30) DEFAULT 'queued',
  attempts INT DEFAULT 0,
  last_error TEXT,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  sent_at TIMESTAMP
);

ALTER TABLE time_notification_outbox ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS time_approval_workflows (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_clock_events_employee_time ON time_clock_events(employee_id, event_time);
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_clock_events_external_ref ON time_clock_events(company_id, source, external_reference) WHERE external_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_time_attendance_days_company_date ON time_attendance_days(company_id, work_date);
CREATE INDEX IF NOT EXISTS idx_time_assignments_scope ON time_employee_work_profile_assignments(company_id, employee_id, department, position, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_time_schedule_company_date ON time_schedule_entries(company_id, work_date);
CREATE INDEX IF NOT EXISTS idx_time_schedule_employee_date ON time_schedule_entries(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_time_alerts_company_status_date ON time_attendance_alerts(company_id, status, alert_date);
CREATE INDEX IF NOT EXISTS idx_time_alerts_employee_date ON time_attendance_alerts(employee_id, alert_date);
CREATE INDEX IF NOT EXISTS idx_time_notification_outbox_status ON time_notification_outbox(status, channel, created_at);

CREATE TABLE IF NOT EXISTS time_processing_jobs (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE CASCADE,
  job_type VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  total_count INT DEFAULT 0,
  processed_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  payload JSONB DEFAULT '{}'::jsonb,
  requested_by INT REFERENCES users(id),
  errors JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_processing_jobs_company_created ON time_processing_jobs(company_id, created_at DESC);

INSERT INTO permissions (name, module) VALUES
  ('time:read', 'time'),
  ('time:write', 'time'),
  ('time:configure', 'time'),
  ('time:input', 'time'),
  ('time:calculate', 'time'),
  ('time:validate', 'time'),
  ('time:export', 'time'),
  ('time:import', 'time')
ON CONFLICT (name) DO NOTHING;
