import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { Payroll } from '../payroll/payroll.entity';
import { Leave } from '../leave/leave.entity';
import { Company } from '../companies/company.entity';
import { Contract } from '../contracts/contract.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Employee) private empRepo: Repository<Employee>,
    @InjectRepository(Payroll)  private payrollRepo: Repository<Payroll>,
    @InjectRepository(Leave)    private leaveRepo: Repository<Leave>,
    @InjectRepository(Company)  private companyRepo: Repository<Company>,
    @InjectRepository(Contract) private contractRepo: Repository<Contract>,
  ) {}

  /**
   * Stats du tableau de bord.
   * Si companyId fourni → données filtrées pour cette entreprise uniquement.
   * Sinon → données globales (mode admin).
   */
  async getDashboardStats(companyId?: number) {
    const now = new Date();

    if (companyId) {
      // ── Mode entreprise : tout filtré par companyId ──────────────
      const [totalEmployees, pendingLeaves, activeContracts] = await Promise.all([
        this.empRepo.count({ where: { companyId, status: 'active' as any } }),
        this.leaveRepo
          .createQueryBuilder('l')
          .innerJoin('l.employee', 'e')
          .where('e.companyId = :companyId', { companyId })
          .andWhere('l.status = :status', { status: 'pending' })
          .getCount(),
        this.contractRepo
          .createQueryBuilder('c')
          .innerJoin('c.employee', 'e')
          .where('e.companyId = :companyId', { companyId })
          .andWhere('c.status = :status', { status: 'active' })
          .getCount(),
      ]);

      // Masse salariale du mois pour cette entreprise
      const payrolls = await this.payrollRepo
        .createQueryBuilder('p')
        .innerJoin('p.employee', 'e')
        .where('e.companyId = :companyId', { companyId })
        .andWhere('p.month = :month', { month: now.getMonth() + 1 })
        .andWhere('p.year = :year', { year: now.getFullYear() })
        .getMany();

      const masseSalariale = payrolls.reduce((s, p) => s + Number(p.netSalary), 0);

      // Évolution masse salariale sur 12 mois
      const evolution = await this._getEvolution(companyId, now.getFullYear());

      return {
        totalEmployees,
        pendingLeaves,
        activeContracts,
        masseSalariale,
        evolution,
        companyId,
      };
    }

    // ── Mode global (sans companyId) ─────────────────────────────
    const [totalEmployees, activeCompanies, pendingLeaves] = await Promise.all([
      this.empRepo.count(),
      this.companyRepo.count({ where: { isActive: true } }),
      this.leaveRepo.count({ where: { status: 'pending' as any } }),
    ]);

    const payrolls = await this.payrollRepo.find({
      where: { month: now.getMonth() + 1, year: now.getFullYear() },
    });
    const masseSalariale = payrolls.reduce((s, p) => s + Number(p.netSalary), 0);

    return { totalEmployees, activeCompanies, pendingLeaves, masseSalariale };
  }

  /** Évolution mensuelle de la masse salariale pour une entreprise */
  private async _getEvolution(companyId: number, year: number) {
    const rows = await this.payrollRepo
      .createQueryBuilder('p')
      .innerJoin('p.employee', 'e')
      .select('p.month', 'month')
      .addSelect('SUM(p.netSalary)', 'total')
      .where('e.companyId = :companyId', { companyId })
      .andWhere('p.year = :year', { year })
      .groupBy('p.month')
      .orderBy('p.month', 'ASC')
      .getRawMany();

    const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    return MONTHS.map((name, i) => {
      const row = rows.find((r) => Number(r.month) === i + 1);
      return { name, masse: row ? Number(row.total) : 0 };
    });
  }

  async getPayrollReport(month: number, year: number, companyId?: number) {
    const qb = this.payrollRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.employee', 'e')
      .leftJoinAndSelect('p.details', 'd')
      .where('p.month = :month AND p.year = :year', { month, year });

    if (companyId) qb.andWhere('e.companyId = :companyId', { companyId });

    return qb.getMany();
  }

  async getLeaveReport(year: number, companyId?: number) {
    const qb = this.leaveRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.employee', 'e')
      .where('EXTRACT(YEAR FROM l.createdAt) = :year', { year });

    if (companyId) qb.andWhere('e.companyId = :companyId', { companyId });

    return qb.getMany();
  }
}
