ALTER TABLE users RENAME COLUMN "firstName" TO first_name;
ALTER TABLE users RENAME COLUMN "lastName" TO last_name;
ALTER TABLE users RENAME COLUMN "isActive" TO is_active;
ALTER TABLE users RENAME COLUMN "lastLogin" TO last_login;
ALTER TABLE users RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE users RENAME COLUMN "updatedAt" TO updated_at;

ALTER TABLE companies RENAME COLUMN "idNat" TO id_nat;
ALTER TABLE companies RENAME COLUMN "taxNumber" TO tax_number;
ALTER TABLE companies RENAME COLUMN "isActive" TO is_active;
ALTER TABLE companies RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE companies RENAME COLUMN "updatedAt" TO updated_at;

UPDATE employees SET company_id = "companyId" WHERE company_id IS NULL AND "companyId" IS NOT NULL;
ALTER TABLE employees RENAME COLUMN "lastName" TO last_name;
ALTER TABLE employees RENAME COLUMN "middleName" TO middle_name;
ALTER TABLE employees RENAME COLUMN "firstName" TO first_name;
ALTER TABLE employees RENAME COLUMN "birthDate" TO birth_date;
ALTER TABLE employees RENAME COLUMN "baseSalary" TO base_salary;
ALTER TABLE employees RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE employees RENAME COLUMN "updatedAt" TO updated_at;

UPDATE contracts SET employee_id = "employeeId" WHERE employee_id IS NULL AND "employeeId" IS NOT NULL;
ALTER TABLE contracts RENAME COLUMN "startDate" TO start_date;
ALTER TABLE contracts RENAME COLUMN "endDate" TO end_date;
ALTER TABLE contracts RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE contracts RENAME COLUMN "updatedAt" TO updated_at;

UPDATE payrolls SET employee_id = "employeeId" WHERE employee_id IS NULL AND "employeeId" IS NOT NULL;
ALTER TABLE payrolls RENAME COLUMN "baseSalary" TO base_salary;
ALTER TABLE payrolls RENAME COLUMN "totalAllowances" TO total_allowances;
ALTER TABLE payrolls RENAME COLUMN "totalDeductions" TO total_deductions;
ALTER TABLE payrolls RENAME COLUMN "netSalary" TO net_salary;
ALTER TABLE payrolls RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE payrolls RENAME COLUMN "updatedAt" TO updated_at;

UPDATE payroll_details SET payroll_id = "payrollId" WHERE payroll_id IS NULL AND "payrollId" IS NOT NULL;

UPDATE leave_requests SET employee_id = "employeeId" WHERE employee_id IS NULL AND "employeeId" IS NOT NULL;
ALTER TABLE leave_requests RENAME COLUMN "startDate" TO start_date;
ALTER TABLE leave_requests RENAME COLUMN "endDate" TO end_date;
ALTER TABLE leave_requests RENAME COLUMN "approvedBy" TO approved_by;
ALTER TABLE leave_requests RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE leave_requests RENAME COLUMN "updatedAt" TO updated_at;
