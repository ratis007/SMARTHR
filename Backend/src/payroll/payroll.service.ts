import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payroll, PayrollStatus } from './payroll.entity';
import { PayrollDetail, DetailType } from './payroll-detail.entity';
import { Employee } from '../employees/employee.entity';
import { CreatePayrollDto } from './dto/create-payroll.dto';

const RATES = { CNSS: 0.05, IPR: 0.15, INPP: 0.02, ONEM: 0.01 };

@Injectable()
export class PayrollService {
  constructor(
    @InjectRepository(Payroll)   private repo: Repository<Payroll>,
    @InjectRepository(Employee)  private empRepo: Repository<Employee>,
  ) {}

  findAll(month?: number, year?: number, page = 1, limit = 1000, companyId?: number) {
    const qb = this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.employee', 'e')
      .leftJoinAndSelect('p.details', 'd')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('p.createdAt', 'DESC');

    if (month)     qb.andWhere('p.month = :month', { month });
    if (year)      qb.andWhere('p.year = :year', { year });
    // Filtre par company via la colonne companyId de l'employé (vraie FK)
    if (companyId) qb.andWhere('e.companyId = :companyId', { companyId });

    return qb.getMany();
  }

  async findOne(id: number) {
    const p = await this.repo.findOne({ where: { id }, relations: ['employee', 'details'] });
    if (!p) throw new NotFoundException('Fiche de paie non trouvée');
    return p;
  }

  async generate(dto: CreatePayrollDto) {
    const employee = await this.empRepo.findOne({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Employé non trouvé');

    const existing = await this.repo.findOne({
      where: { employeeId: dto.employeeId, month: dto.month, year: dto.year },
    });
    if (existing) {
      throw new ConflictException(
        `Une fiche de paie existe déjà pour ${employee.lastName} ${employee.firstName} en ${dto.month}/${dto.year}`
      );
    }

    const base = dto.baseSalary ?? Number(employee.baseSalary);
    if (!base || base <= 0) {
      throw new BadRequestException(
        `Salaire de base invalide (${base} CDF) pour ${employee.lastName}. Veuillez définir un salaire avant de générer la paie.`
      );
    }

    const details: Partial<PayrollDetail>[] = [];
    const cnss = base * RATES.CNSS;
    const ipr  = base * RATES.IPR;
    const inpp = base * RATES.INPP;
    const onem = base * RATES.ONEM;

    details.push({ label: 'CNSS (5%)',  type: DetailType.DEDUCTION, amount: cnss, rate: RATES.CNSS * 100 });
    details.push({ label: 'IPR (15%)',  type: DetailType.DEDUCTION, amount: ipr,  rate: RATES.IPR  * 100 });
    details.push({ label: 'INPP (2%)',  type: DetailType.DEDUCTION, amount: inpp, rate: RATES.INPP * 100 });
    details.push({ label: 'ONEM (1%)',  type: DetailType.DEDUCTION, amount: onem, rate: RATES.ONEM * 100 });

    if (dto.allowances) {
      for (const a of dto.allowances) {
        details.push({ label: a.label, type: DetailType.ALLOWANCE, amount: a.amount });
      }
    }

    const totalDeductions = cnss + ipr + inpp + onem;
    const totalAllowances = dto.allowances?.reduce((s, a) => s + a.amount, 0) ?? 0;
    const netSalary       = base + totalAllowances - totalDeductions;

    const payroll = await this.repo.save(this.repo.create({
      employeeId: dto.employeeId,
      month: dto.month,
      year: dto.year,
      baseSalary: base,
      totalAllowances,
      totalDeductions,
      netSalary,
    }));

    const detailRepo = this.repo.manager.getRepository(PayrollDetail);
    payroll.details = await detailRepo.save(
      details.map(d => detailRepo.create({ ...d, payrollId: payroll.id }))
    );
    return payroll;
  }

  async validate(id: number) {
    await this.findOne(id);
    await this.repo.update(id, { status: PayrollStatus.VALIDATED });
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { message: 'Fiche de paie supprimée' };
  }

  async getMonthlySummary(month: number, year: number, companyId?: number) {
    const qb = this.repo.createQueryBuilder('p')
      .leftJoin('p.employee', 'e')
      .where('p.month = :month AND p.year = :year', { month, year });

    if (companyId) qb.andWhere('e.companyId = :companyId', { companyId });

    const payrolls = await qb.getMany();
    const totalMasse      = payrolls.reduce((s, p) => s + Number(p.netSalary), 0);
    const totalBrut       = payrolls.reduce((s, p) => s + Number(p.baseSalary) + Number(p.totalAllowances), 0);
    const totalDeductions = payrolls.reduce((s, p) => s + Number(p.totalDeductions), 0);
    return { month, year, count: payrolls.length, totalMasse, totalBrut, totalDeductions };
  }
}
