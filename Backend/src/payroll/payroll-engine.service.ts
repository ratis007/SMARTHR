import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { DetailType } from './payroll-detail.entity';

type VariableInput = { code?: string; label: string; amount: number; currency?: string; type?: 'allowance' | 'deduction'; category?: string; taxable?: boolean; source?: string };
type EngineInput = { employeeId: number; month: number; year: number; baseSalary?: number; allowances?: VariableInput[]; variables?: VariableInput[] };

type RubricRow = {
  code: string;
  label: string;
  category: string;
  calculation_type: string;
  value: string | number;
  is_taxable: boolean;
  is_active: boolean;
  is_required: boolean;
};

@Injectable()
export class PayrollEngineService implements OnModuleInit {
  constructor(private dataSource: DataSource) {}

  async onModuleInit() {
    await this.ensureSchema();
    await this.seedDefaults();
  }

  async getConfiguration(companyId?: number) {
    const [rubrics, legalRates, iprBrackets] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM payroll_rubrics WHERE company_id IS NULL OR company_id = $1 ORDER BY sort_order, code`,
        [companyId || null],
      ),
      this.dataSource.query(
        `SELECT * FROM payroll_legal_rates WHERE company_id IS NULL OR company_id = $1 ORDER BY contribution_code, effective_from DESC`,
        [companyId || null],
      ),
      this.dataSource.query(
        `SELECT * FROM payroll_ipr_brackets WHERE company_id IS NULL OR company_id = $1 ORDER BY effective_from DESC, min_amount ASC`,
        [companyId || null],
      ),
    ]);
    return { rubrics, legalRates, iprBrackets };
  }

  async createRubric(companyId: number | null, dto: any, userId?: number) {
    const code = String(dto.code || '').trim().toUpperCase();
    if (!code) throw new BadRequestException('Code rubrique obligatoire');

    const [rubric] = await this.dataSource.query(`
      INSERT INTO payroll_rubrics (
        company_id, code, label, category, calculation_type, value, is_taxable, is_active, is_required, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (company_id, code) DO UPDATE SET
        label = EXCLUDED.label,
        category = EXCLUDED.category,
        calculation_type = EXCLUDED.calculation_type,
        value = EXCLUDED.value,
        is_taxable = EXCLUDED.is_taxable,
        is_active = EXCLUDED.is_active,
        is_required = EXCLUDED.is_required,
        updated_at = NOW()
      RETURNING *
    `, [
      companyId || null,
      code,
      dto.label,
      dto.category || 'variable_earning',
      dto.calculationType || 'fixed_amount',
      Number(dto.value || 0),
      dto.isTaxable !== false,
      dto.isActive !== false,
      dto.isRequired === true,
      userId || null,
    ]);
    return rubric;
  }

  async createLegalRate(companyId: number | null, dto: any, userId?: number) {
    const contributionCode = String(dto.contributionCode || '').trim().toUpperCase();
    if (!contributionCode) throw new BadRequestException('Code contribution obligatoire');
    if (!dto.label) throw new BadRequestException('Libelle contribution obligatoire');
    if (!dto.effectiveFrom) throw new BadRequestException("Date d'entree en vigueur obligatoire");

    const [versionRow] = await this.dataSource.query(`
      SELECT COALESCE(MAX(version), 0) + 1 AS version
      FROM payroll_legal_rates
      WHERE ((company_id IS NULL AND $1::int IS NULL) OR company_id = $1)
        AND contribution_code = $2
    `, [companyId || null, contributionCode]);

    const [rate] = await this.dataSource.query(`
      INSERT INTO payroll_legal_rates (
        company_id, contribution_code, label, employee_rate, employer_rate,
        effective_from, effective_to, version, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [
      companyId || null,
      contributionCode,
      dto.label,
      Number(dto.employeeRate || 0),
      Number(dto.employerRate || 0),
      dto.effectiveFrom,
      dto.effectiveTo || null,
      Number(versionRow.version),
      userId || null,
    ]);
    return rate;
  }

  async createIprBracket(companyId: number | null, dto: any, userId?: number) {
    if (dto.minAmount === undefined) throw new BadRequestException('Montant minimum obligatoire');
    if (dto.rate === undefined) throw new BadRequestException('Taux IPR obligatoire');
    if (!dto.effectiveFrom) throw new BadRequestException("Date d'entree en vigueur obligatoire");

    const [versionRow] = await this.dataSource.query(`
      SELECT COALESCE(MAX(version), 0) + 1 AS version
      FROM payroll_ipr_brackets
      WHERE ((company_id IS NULL AND $1::int IS NULL) OR company_id = $1)
    `, [companyId || null]);

    const [bracket] = await this.dataSource.query(`
      INSERT INTO payroll_ipr_brackets (
        company_id, min_amount, max_amount, rate, fixed_amount,
        effective_from, effective_to, version, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [
      companyId || null,
      Number(dto.minAmount),
      dto.maxAmount === undefined || dto.maxAmount === null || dto.maxAmount === '' ? null : Number(dto.maxAmount),
      Number(dto.rate),
      Number(dto.fixedAmount || 0),
      dto.effectiveFrom,
      dto.effectiveTo || null,
      Number(versionRow.version),
      userId || null,
    ]);
    return bracket;
  }

  async createVariable(companyId: number | null, dto: any, userId?: number) {
    if (!dto.employeeId) throw new BadRequestException('Employe obligatoire');
    if (!dto.month || !dto.year) throw new BadRequestException('Periode obligatoire');
    const code = String(dto.code || '').trim().toUpperCase();
    if (!code) throw new BadRequestException('Code element variable obligatoire');
    if (!dto.label) throw new BadRequestException('Libelle element variable obligatoire');
    if (!['allowance', 'deduction'].includes(dto.type)) throw new BadRequestException('Type element variable invalide');

    const [variable] = await this.dataSource.query(`
      INSERT INTO payroll_variable_inputs (
        company_id, employee_id, month, year, code, label, type, category,
        amount, currency, taxable, source, status, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'manual','active',$12)
      RETURNING *
    `, [
      companyId || null,
      Number(dto.employeeId),
      Number(dto.month),
      Number(dto.year),
      code,
      dto.label,
      dto.type,
      dto.category || (dto.type === 'deduction' ? 'internal_deduction' : 'variable_earning'),
      Number(dto.amount || 0),
      dto.currency || 'CDF',
      dto.taxable !== false,
      userId || null,
    ]);
    return variable;
  }

  async createTimeInput(companyId: number | null, dto: any, userId?: number) {
    if (!dto.employeeId) throw new BadRequestException('Employe obligatoire');
    if (!dto.month || !dto.year) throw new BadRequestException('Periode obligatoire');

    const [input] = await this.dataSource.query(`
      INSERT INTO payroll_time_inputs (
        company_id, employee_id, month, year, overtime_hours, night_hours,
        sunday_hours, holiday_hours, unpaid_absence_days, late_minutes,
        notes, status, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',$12)
      RETURNING *
    `, [
      companyId || null,
      Number(dto.employeeId),
      Number(dto.month),
      Number(dto.year),
      Number(dto.overtimeHours || 0),
      Number(dto.nightHours || 0),
      Number(dto.sundayHours || 0),
      Number(dto.holidayHours || 0),
      Number(dto.unpaidAbsenceDays || 0),
      Number(dto.lateMinutes || 0),
      dto.notes || null,
      userId || null,
    ]);
    return input;
  }

  async listTimeInputs(companyId: number | null, month?: number, year?: number, employeeId?: number) {
    const params: any[] = [companyId || null];
    let sql = `
      SELECT t.*, e.matricule, e.last_name, e.first_name
      FROM payroll_time_inputs t
      LEFT JOIN employees e ON e.id = t.employee_id
      WHERE (t.company_id IS NULL OR t.company_id = $1)
        AND t.status = 'active'
    `;
    if (month) { params.push(month); sql += ` AND t.month = $${params.length}`; }
    if (year) { params.push(year); sql += ` AND t.year = $${params.length}`; }
    if (employeeId) { params.push(employeeId); sql += ` AND t.employee_id = $${params.length}`; }
    sql += ' ORDER BY t.created_at DESC';
    return this.dataSource.query(sql, params);
  }

  async listVariables(companyId: number | null, month?: number, year?: number, employeeId?: number) {
    const params: any[] = [companyId || null];
    let sql = `
      SELECT v.*, e.matricule, e.last_name, e.first_name
      FROM payroll_variable_inputs v
      LEFT JOIN employees e ON e.id = v.employee_id
      WHERE (v.company_id IS NULL OR v.company_id = $1)
        AND v.status = 'active'
    `;
    if (month) { params.push(month); sql += ` AND v.month = $${params.length}`; }
    if (year) { params.push(year); sql += ` AND v.year = $${params.length}`; }
    if (employeeId) { params.push(employeeId); sql += ` AND v.employee_id = $${params.length}`; }
    sql += ' ORDER BY v.created_at DESC';
    return this.dataSource.query(sql, params);
  }

  async compute(input: EngineInput) {
    const employee = await this.dataSource.getRepository(Employee).findOne({
      where: { id: input.employeeId },
      relations: ['company', 'contracts'],
    });
    if (!employee) throw new NotFoundException('Employe non trouve');

    const periodDate = new Date(Date.UTC(input.year, input.month - 1, 1));
    const activeContract = (employee.contracts || []).find((contract: any) => contract.status === 'active') || employee.contracts?.[0];
    const baseSalary = Number(input.baseSalary ?? activeContract?.salary ?? employee.baseSalary ?? 0);
    if (!baseSalary || baseSalary <= 0) throw new BadRequestException('Salaire de base invalide pour la generation de paie');

    const currency = await this.getCurrency(employee.companyId);
    const rubrics = await this.getRubrics(employee.companyId);
    const legalRates = await this.getLegalRates(employee.companyId, periodDate);
    const iprBrackets = await this.getIprBrackets(employee.companyId, periodDate);
    const storedVariables = await this.getVariableInputs(employee.companyId, employee.id, input.month, input.year);
    const variables = [...storedVariables, ...(input.allowances || []), ...(input.variables || [])];

    const details: any[] = [];
    const timeDetails = await this.computeTimeDetails(employee.companyId, employee.id, input.month, input.year, baseSalary);
    details.push(...timeDetails);
    const fixedVariableTotal = variables.reduce((sum, item) => sum + this.toCdf(Number(item.amount || 0), item.currency || 'CDF', currency.rate), 0);
    for (const item of variables) {
      const amount = this.toCdf(Number(item.amount || 0), item.currency || 'CDF', currency.rate);
      const isDeduction = item.type === 'deduction';
      details.push({
        code: item.code || 'VARIABLE',
        label: item.label,
        category: item.category || (isDeduction ? 'internal_deduction' : 'variable_earning'),
        type: isDeduction ? DetailType.DEDUCTION : DetailType.ALLOWANCE,
        baseAmount: amount,
        amount,
        employerAmount: 0,
        rate: null,
        metadata: { source: item.source || 'manual_variable', taxable: item.taxable !== false },
      });
    }

    for (const rubric of rubrics.filter((r) => r.is_active)) {
      if (rubric.category === 'variable_earning' || rubric.category === 'benefit' || rubric.category === 'indemnity') {
        const amount = this.computeRubricAmount(rubric, baseSalary, fixedVariableTotal);
        if (!amount) continue;
        details.push({
          code: rubric.code,
          label: rubric.label,
          category: rubric.category,
          type: DetailType.ALLOWANCE,
          baseAmount: baseSalary,
          amount,
          employerAmount: 0,
          rate: Number(rubric.value || 0),
          metadata: { calculationType: rubric.calculation_type },
        });
      }
    }

    const totalAllowances = details.filter((d) => d.type === DetailType.ALLOWANCE).reduce((sum, d) => sum + Number(d.amount), 0);
    const grossSalary = baseSalary + totalAllowances;
    const taxableSalary = baseSalary + details
      .filter((d) => d.type === DetailType.ALLOWANCE)
      .filter((d) => d.metadata?.taxable !== false && rubrics.find((r) => r.code === d.code)?.is_taxable !== false)
      .reduce((sum, d) => sum + Number(d.amount), 0);

    const cnssEmployee = this.percentAmount(baseSalary, legalRates.CNSS_EMPLOYEE);
    const cnssEmployer = this.percentAmount(baseSalary, legalRates.CNSS_EMPLOYER);
    const inppEmployer = this.percentAmount(grossSalary, legalRates.INPP_EMPLOYER);
    const onemEmployer = this.percentAmount(grossSalary, legalRates.ONEM_EMPLOYER);
    const ipr = this.computeProgressiveTax(Math.max(taxableSalary - cnssEmployee, 0), iprBrackets);

    details.push(
      this.legalDetail('CNSS_EMPLOYEE', 'CNSS Employe', baseSalary, cnssEmployee, 0, legalRates.CNSS_EMPLOYEE),
      this.legalDetail('IPR', 'IPR - Bareme progressif', taxableSalary, ipr, 0, null),
      this.legalDetail('CNSS_EMPLOYER', 'CNSS Employeur', baseSalary, 0, cnssEmployer, legalRates.CNSS_EMPLOYER),
      this.legalDetail('INPP_EMPLOYER', 'INPP Employeur', grossSalary, 0, inppEmployer, legalRates.INPP_EMPLOYER),
      this.legalDetail('ONEM_EMPLOYER', 'ONEM Employeur', grossSalary, 0, onemEmployer, legalRates.ONEM_EMPLOYER),
    );

    const employeeDeductions = details.filter((d) => d.type === DetailType.DEDUCTION).reduce((sum, d) => sum + Number(d.amount), 0);
    const employerContributions = details.reduce((sum, d) => sum + Number(d.employerAmount || 0), 0);
    const netFiscal = taxableSalary - cnssEmployee - ipr;
    const netSalary = grossSalary - employeeDeductions;

    const snapshot = {
      version: 'RDC-PAYROLL-ENGINE-V1',
      generatedAt: new Date().toISOString(),
      period: { month: input.month, year: input.year },
      employee: {
        id: employee.id,
        matricule: employee.matricule,
        name: `${employee.lastName} ${employee.firstName}`,
        department: employee.department,
        position: employee.position,
        companyId: employee.companyId,
      },
      contract: activeContract ? {
        id: activeContract.id,
        type: activeContract.type,
        startDate: activeContract.startDate,
        endDate: activeContract.endDate,
      } : null,
      currency,
      legalRates,
      iprBrackets,
      rubrics: rubrics.map((r) => ({ code: r.code, label: r.label, category: r.category, calculationType: r.calculation_type, value: r.value })),
      timeInputs: timeDetails.map((d) => ({ code: d.code, label: d.label, amount: d.amount, employerAmount: d.employerAmount })),
      totals: { baseSalary, grossSalary, taxableSalary, employeeDeductions, employerContributions, netFiscal, netSalary },
    };

    return {
      employee,
      baseSalary: this.round(baseSalary),
      totalAllowances: this.round(totalAllowances),
      totalDeductions: this.round(employeeDeductions),
      grossSalary: this.round(grossSalary),
      taxableSalary: this.round(taxableSalary),
      netFiscal: this.round(netFiscal),
      employerContributions: this.round(employerContributions),
      netSalary: this.round(netSalary),
      currency: currency.primaryCurrency,
      exchangeRate: currency.rate,
      details: details.map((detail) => ({ ...detail, amount: this.round(detail.amount), employerAmount: this.round(detail.employerAmount || 0) })),
      snapshot,
    };
  }

  private async getCurrency(companyId?: number) {
    const [row] = await this.dataSource.query(
      `SELECT primary_currency, usd_to_cdf_rate FROM currency_settings WHERE company_id = $1 LIMIT 1`,
      [companyId || null],
    );
    return {
      primaryCurrency: row?.primary_currency || 'CDF',
      rate: Number(row?.usd_to_cdf_rate || 2850),
    };
  }

  private async getRubrics(companyId?: number): Promise<RubricRow[]> {
    return this.dataSource.query(
      `SELECT * FROM payroll_rubrics WHERE company_id IS NULL OR company_id = $1 ORDER BY sort_order, code`,
      [companyId || null],
    );
  }

  private async getLegalRates(companyId: number, periodDate: Date) {
    const rows = await this.dataSource.query(`
      SELECT DISTINCT ON (contribution_code) contribution_code, employee_rate, employer_rate
      FROM payroll_legal_rates
      WHERE (company_id IS NULL OR company_id = $1)
        AND effective_from <= $2
        AND (effective_to IS NULL OR effective_to >= $2)
      ORDER BY contribution_code, company_id NULLS LAST, effective_from DESC
    `, [companyId || null, periodDate]);

    const rates = { CNSS_EMPLOYEE: 5, CNSS_EMPLOYER: 13, INPP_EMPLOYER: 1, ONEM_EMPLOYER: 0.2 };
    for (const row of rows) {
      if (row.contribution_code === 'CNSS') {
        rates.CNSS_EMPLOYEE = Number(row.employee_rate || rates.CNSS_EMPLOYEE);
        rates.CNSS_EMPLOYER = Number(row.employer_rate || rates.CNSS_EMPLOYER);
      }
      if (row.contribution_code === 'INPP') rates.INPP_EMPLOYER = Number(row.employer_rate || rates.INPP_EMPLOYER);
      if (row.contribution_code === 'ONEM') rates.ONEM_EMPLOYER = Number(row.employer_rate || rates.ONEM_EMPLOYER);
    }
    return rates;
  }

  private async getIprBrackets(companyId: number, periodDate: Date) {
    const rows = await this.dataSource.query(`
      SELECT min_amount, max_amount, rate, fixed_amount
      FROM payroll_ipr_brackets
      WHERE (company_id IS NULL OR company_id = $1)
        AND effective_from <= $2
        AND (effective_to IS NULL OR effective_to >= $2)
      ORDER BY min_amount ASC
    `, [companyId || null, periodDate]);
    return rows.length ? rows.map((r) => ({
      min: Number(r.min_amount),
      max: r.max_amount === null ? null : Number(r.max_amount),
      rate: Number(r.rate),
      fixedAmount: Number(r.fixed_amount || 0),
    })) : [{ min: 0, max: null, rate: 15, fixedAmount: 0 }];
  }

  private async getVariableInputs(companyId: number, employeeId: number, month: number, year: number): Promise<VariableInput[]> {
    const rows = await this.dataSource.query(`
      SELECT code, label, type, category, amount, currency, taxable, source
      FROM payroll_variable_inputs
      WHERE employee_id = $1
        AND month = $2
        AND year = $3
        AND status = 'active'
        AND (company_id IS NULL OR company_id = $4)
      ORDER BY created_at ASC
    `, [employeeId, month, year, companyId || null]);
    return rows.map((row) => ({
      code: row.code,
      label: row.label,
      type: row.type,
      category: row.category,
      amount: Number(row.amount || 0),
      currency: row.currency || 'CDF',
      taxable: row.taxable !== false,
      source: row.source || 'stored_variable',
    }));
  }

  private async computeTimeDetails(companyId: number, employeeId: number, month: number, year: number, baseSalary: number) {
    const rows = await this.dataSource.query(`
      SELECT *
      FROM payroll_time_inputs
      WHERE employee_id = $1
        AND month = $2
        AND year = $3
        AND status = 'active'
        AND (company_id IS NULL OR company_id = $4)
      ORDER BY created_at ASC
    `, [employeeId, month, year, companyId || null]);

    const monthlyHours = 173.33;
    const workDays = 26;
    const hourlyRate = baseSalary / monthlyHours;
    const dailyRate = baseSalary / workDays;
    const totals = rows.reduce((sum, row) => ({
      overtimeHours: sum.overtimeHours + Number(row.overtime_hours || 0),
      nightHours: sum.nightHours + Number(row.night_hours || 0),
      sundayHours: sum.sundayHours + Number(row.sunday_hours || 0),
      holidayHours: sum.holidayHours + Number(row.holiday_hours || 0),
      unpaidAbsenceDays: sum.unpaidAbsenceDays + Number(row.unpaid_absence_days || 0),
      lateMinutes: sum.lateMinutes + Number(row.late_minutes || 0),
    }), { overtimeHours: 0, nightHours: 0, sundayHours: 0, holidayHours: 0, unpaidAbsenceDays: 0, lateMinutes: 0 });

    const details: any[] = [];
    const addAllowance = (code: string, label: string, hours: number, multiplier: number) => {
      if (hours <= 0) return;
      details.push({
        code,
        label,
        category: 'time_attendance',
        type: DetailType.ALLOWANCE,
        baseAmount: hourlyRate,
        amount: hours * hourlyRate * multiplier,
        employerAmount: 0,
        rate: multiplier * 100,
        metadata: { source: 'time_input', hours, multiplier, taxable: true },
      });
    };

    addAllowance('OVERTIME', 'Heures supplementaires', totals.overtimeHours, 1.3);
    addAllowance('NIGHT_WORK', 'Travail de nuit', totals.nightHours, 1.5);
    addAllowance('SUNDAY_WORK', 'Travail dominical', totals.sundayHours, 2);
    addAllowance('HOLIDAY_WORK', 'Jour ferie travaille', totals.holidayHours, 2);

    const absenceDeduction = totals.unpaidAbsenceDays * dailyRate + (totals.lateMinutes / 60) * hourlyRate;
    if (absenceDeduction > 0) {
      details.push({
        code: 'UNPAID_ABSENCE',
        label: 'Absences et retards non payes',
        category: 'time_attendance',
        type: DetailType.DEDUCTION,
        baseAmount: dailyRate,
        amount: absenceDeduction,
        employerAmount: 0,
        rate: null,
        metadata: {
          source: 'time_input',
          unpaidAbsenceDays: totals.unpaidAbsenceDays,
          lateMinutes: totals.lateMinutes,
        },
      });
    }

    return details;
  }

  private computeRubricAmount(rubric: RubricRow, baseSalary: number, variableTotal: number) {
    const value = Number(rubric.value || 0);
    if (rubric.calculation_type === 'percent_of_base') return baseSalary * value / 100;
    if (rubric.calculation_type === 'percent_of_gross_variables') return variableTotal * value / 100;
    if (rubric.calculation_type === 'fixed_amount') return value;
    return 0;
  }

  private computeProgressiveTax(taxable: number, brackets: Array<{ min: number; max: number | null; rate: number; fixedAmount: number }>) {
    let tax = 0;
    for (const bracket of brackets) {
      if (taxable <= bracket.min) continue;
      const upper = bracket.max === null ? taxable : Math.min(taxable, bracket.max);
      if (upper <= bracket.min) continue;
      tax += (upper - bracket.min) * bracket.rate / 100 + bracket.fixedAmount;
      if (bracket.max !== null && taxable <= bracket.max) break;
    }
    return tax;
  }

  private legalDetail(code: string, label: string, baseAmount: number, amount: number, employerAmount: number, rate: number | null) {
    return {
      code,
      label,
      category: 'legal_contribution',
      type: amount > 0 ? DetailType.DEDUCTION : DetailType.ALLOWANCE,
      baseAmount,
      amount,
      employerAmount,
      rate,
      metadata: { statutory: true },
    };
  }

  private percentAmount(base: number, rate: number) {
    return Number(base || 0) * Number(rate || 0) / 100;
  }

  private toCdf(amount: number, currency: string, rate: number) {
    return currency === 'USD' ? amount * rate : amount;
  }

  private round(value: number) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  private async ensureSchema() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS payroll_rubrics (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        code VARCHAR(80) NOT NULL,
        label VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        calculation_type VARCHAR(50) NOT NULL DEFAULT 'fixed_amount',
        value DECIMAL(15,4) DEFAULT 0,
        is_taxable BOOLEAN DEFAULT TRUE,
        is_active BOOLEAN DEFAULT TRUE,
        is_required BOOLEAN DEFAULT FALSE,
        sort_order INT DEFAULT 100,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, code)
      )
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS payroll_legal_rates (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        contribution_code VARCHAR(50) NOT NULL,
        label VARCHAR(255) NOT NULL,
        employee_rate DECIMAL(8,4) DEFAULT 0,
        employer_rate DECIMAL(8,4) DEFAULT 0,
        effective_from DATE NOT NULL,
        effective_to DATE,
        version INT DEFAULT 1,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS payroll_ipr_brackets (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        min_amount DECIMAL(15,2) NOT NULL,
        max_amount DECIMAL(15,2),
        rate DECIMAL(8,4) NOT NULL,
        fixed_amount DECIMAL(15,2) DEFAULT 0,
        effective_from DATE NOT NULL,
        effective_to DATE,
        version INT DEFAULT 1,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await this.dataSource.query(`
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
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'CDF',
        taxable BOOLEAN DEFAULT TRUE,
        source VARCHAR(50) DEFAULT 'manual',
        status VARCHAR(20) DEFAULT 'active',
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS payroll_time_inputs (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
        month INT NOT NULL,
        year INT NOT NULL,
        overtime_hours DECIMAL(10,2) DEFAULT 0,
        night_hours DECIMAL(10,2) DEFAULT 0,
        sunday_hours DECIMAL(10,2) DEFAULT 0,
        holiday_hours DECIMAL(10,2) DEFAULT 0,
        unpaid_absence_days DECIMAL(10,2) DEFAULT 0,
        late_minutes INT DEFAULT 0,
        notes TEXT,
        status VARCHAR(20) DEFAULT 'active',
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await this.dataSource.query(`ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS gross_salary DECIMAL(15,2) DEFAULT 0`);
    await this.dataSource.query(`ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS taxable_salary DECIMAL(15,2) DEFAULT 0`);
    await this.dataSource.query(`ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS net_fiscal DECIMAL(15,2) DEFAULT 0`);
    await this.dataSource.query(`ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS employer_contributions DECIMAL(15,2) DEFAULT 0`);
    await this.dataSource.query(`ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'CDF'`);
    await this.dataSource.query(`ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(15,4) DEFAULT 1`);
    await this.dataSource.query(`ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS workflow_step VARCHAR(30) DEFAULT 'draft'`);
    await this.dataSource.query(`ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS calculation_snapshot JSONB`);
    await this.dataSource.query(`ALTER TABLE payroll_details ADD COLUMN IF NOT EXISTS code VARCHAR(80)`);
    await this.dataSource.query(`ALTER TABLE payroll_details ADD COLUMN IF NOT EXISTS category VARCHAR(50)`);
    await this.dataSource.query(`ALTER TABLE payroll_details ADD COLUMN IF NOT EXISTS base_amount DECIMAL(15,2)`);
    await this.dataSource.query(`ALTER TABLE payroll_details ADD COLUMN IF NOT EXISTS employer_amount DECIMAL(15,2) DEFAULT 0`);
    await this.dataSource.query(`ALTER TABLE payroll_details ADD COLUMN IF NOT EXISTS metadata JSONB`);
  }

  private async seedDefaults() {
    await this.dataSource.query(`
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
      )
    `);
    await this.dataSource.query(`
      INSERT INTO payroll_ipr_brackets (min_amount, max_amount, rate, effective_from, version)
      SELECT 0, NULL, 15, '2026-01-01', 1
      WHERE NOT EXISTS (
        SELECT 1 FROM payroll_ipr_brackets b
        WHERE b.company_id IS NULL
          AND b.min_amount = 0
          AND b.max_amount IS NULL
          AND b.effective_from = '2026-01-01'
          AND b.version = 1
      )
    `);
    await this.dataSource.query(`
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
      )
    `);
  }
}
