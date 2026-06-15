import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Employee } from './employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee) private repo: Repository<Employee>,
    private dataSource: DataSource,
  ) {}

  async findAll(companyId?: number, page = 1, limit = 1000, search?: string) {
    const qb = this.repo.createQueryBuilder('e')
      .leftJoinAndSelect('e.company', 'company')
      .take(limit)
      .skip((page - 1) * limit)
      .orderBy('e.lastName', 'ASC');

    if (companyId) qb.andWhere('e.companyId = :companyId', { companyId });
    if (search) {
      qb.andWhere(
        '(e.lastName ILIKE :s OR e.firstName ILIKE :s OR e.matricule ILIKE :s OR e.department ILIKE :s OR e.position ILIKE :s)',
        { s: `%${search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: number) {
    const employee = await this.repo.findOne({ where: { id }, relations: ['company', 'contracts'] });
    if (!employee) throw new NotFoundException('Employe non trouve');
    return employee;
  }

  async getDossier(id: number) {
    const employee = await this.findOne(id);
    const [contracts, payrolls, leaves, documents, auditLogs] = await Promise.all([
      this.dataSource.query('SELECT * FROM contracts WHERE employee_id = $1 ORDER BY start_date DESC, created_at DESC', [id]),
      this.dataSource.query('SELECT * FROM payrolls WHERE employee_id = $1 ORDER BY year DESC, month DESC, created_at DESC', [id]),
      this.dataSource.query('SELECT * FROM leave_requests WHERE employee_id = $1 ORDER BY start_date DESC, created_at DESC', [id]),
      this.safeQuery('SELECT * FROM employee_documents WHERE employee_id = $1 ORDER BY created_at DESC', [id]),
      this.safeQuery("SELECT * FROM audit_logs WHERE entity = 'employees' AND entity_id = $1 ORDER BY created_at DESC LIMIT 100", [id]),
    ]);

    const approvedLeaveDays = leaves
      .filter((leave) => leave.status === 'approved')
      .reduce((sum, leave) => sum + Number(leave.days || 0), 0);

    return {
      employee,
      contracts: contracts.map(this.camelContract),
      payrolls: payrolls.map(this.camelPayroll),
      leaves: leaves.map(this.camelLeave),
      documents: documents.map(this.camelDocument),
      auditLogs: auditLogs.map(this.camelAuditLog),
      leaveBalance: {
        annualEntitlement: 26,
        usedDays: approvedLeaveDays,
        remainingDays: Math.max(26 - approvedLeaveDays, 0),
      },
    };
  }

  async create(dto: CreateEmployeeDto) {
    if (!dto.matricule) {
      const count = await this.repo.count();
      dto.matricule = `EMP${String(count + 1).padStart(5, '0')}`;
    }
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: number, dto: UpdateEmployeeDto) {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async setStatus(id: number, status: Employee['status']) {
    await this.findOne(id);
    await this.repo.update(id, { status });
    return this.findOne(id);
  }

  async toggleStatus(id: number) {
    const employee = await this.findOne(id);
    const nextStatus = employee.status === 'active' ? 'inactive' : 'active';
    return this.setStatus(id, nextStatus as Employee['status']);
  }

  async remove(id: number) {
    const employee = await this.findOne(id);
    const [{ count }] = await this.dataSource.query(
      "SELECT COUNT(*)::int AS count FROM payrolls WHERE employee_id = $1 AND status IN ('validated', 'paid')",
      [id],
    );

    if (employee.status === 'active' && Number(count) > 0) {
      throw new BadRequestException("Impossible de supprimer un employe actif lie a un historique de paie valide.");
    }

    await this.repo.update(id, { status: 'inactive' as any });
    return { message: 'Employe archive' };
  }

  async getStats() {
    const total = await this.repo.count();
    const active = await this.repo.count({ where: { status: 'active' as any } });
    const byCompany = await this.repo
      .createQueryBuilder('e')
      .select('e.companyId', 'companyId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('e.companyId')
      .getRawMany();
    return { total, active, inactive: total - active, byCompany };
  }

  private async safeQuery(sql: string, params: any[]) {
    try { return await this.dataSource.query(sql, params); }
    catch { return []; }
  }

  private camelContract(row: any) {
    return {
      id: row.id,
      employeeId: row.employee_id,
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
      salary: row.salary,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private camelPayroll(row: any) {
    return {
      id: row.id,
      employeeId: row.employee_id,
      month: row.month,
      year: row.year,
      baseSalary: row.base_salary,
      totalAllowances: row.total_allowances,
      totalDeductions: row.total_deductions,
      netSalary: row.net_salary,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private camelLeave(row: any) {
    return {
      id: row.id,
      employeeId: row.employee_id,
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
      reason: row.reason,
      status: row.status,
      days: row.days,
      approvedBy: row.approved_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private camelDocument(row: any) {
    return {
      id: row.id,
      employeeId: row.employee_id,
      name: row.name,
      type: row.type,
      filePath: row.file_path,
      createdAt: row.created_at,
    };
  }

  private camelAuditLog(row: any) {
    return {
      id: row.id,
      userId: row.user_id,
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      details: row.details,
      ipAddress: row.ip_address,
      createdAt: row.created_at,
    };
  }
}
