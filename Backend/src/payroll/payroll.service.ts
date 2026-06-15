import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payroll, PayrollStatus } from './payroll.entity';
import { DetailType, PayrollDetail } from './payroll-detail.entity';
import { Employee } from '../employees/employee.entity';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';

const RATES = { CNSS: 0.05, IPR: 0.15, INPP: 0.02, ONEM: 0.01 };

@Injectable()
export class PayrollService {
  constructor(
    @InjectRepository(Payroll) private repo: Repository<Payroll>,
    @InjectRepository(Employee) private empRepo: Repository<Employee>,
  ) {}

  findAll(month?: number, year?: number, page = 1, limit = 1000, companyId?: number) {
    const qb = this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.employee', 'e')
      .leftJoinAndSelect('p.details', 'd')
      .where('p.status != :archived', { archived: PayrollStatus.ARCHIVED })
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('p.createdAt', 'DESC');

    if (month) qb.andWhere('p.month = :month', { month });
    if (year) qb.andWhere('p.year = :year', { year });
    if (companyId) qb.andWhere('e.companyId = :companyId', { companyId });

    return qb.getMany();
  }

  async findOne(id: number) {
    const payroll = await this.repo.findOne({ where: { id }, relations: ['employee', 'details'] });
    if (!payroll) throw new NotFoundException('Fiche de paie non trouvee');
    return payroll;
  }

  async generate(dto: CreatePayrollDto) {
    const employee = await this.empRepo.findOne({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Employe non trouve');

    const existing = await this.repo.findOne({
      where: { employeeId: dto.employeeId, month: dto.month, year: dto.year },
    });
    if (existing) return this.findOne(existing.id);

    const base = dto.baseSalary ?? Number(employee.baseSalary);
    if (!base || base <= 0) {
      throw new BadRequestException(
        `Salaire de base invalide (${base} CDF) pour ${employee.lastName}. Veuillez definir un salaire avant de generer la paie.`,
      );
    }

    const { details, totalAllowances, totalDeductions, netSalary } = this.computePayroll(base, dto.allowances ?? []);
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
    payroll.details = await detailRepo.save(details.map((detail) => detailRepo.create({ ...detail, payrollId: payroll.id })));
    return this.findOne(payroll.id);
  }

  async update(id: number, dto: UpdatePayrollDto) {
    const payroll = await this.findOne(id);
    if (payroll.status !== PayrollStatus.DRAFT) {
      throw new BadRequestException('Seules les fiches de paie brouillon peuvent etre modifiees.');
    }

    const base = dto.baseSalary !== undefined ? Number(dto.baseSalary) : Number(payroll.baseSalary);
    if (!base || base <= 0) throw new BadRequestException('Salaire de base invalide.');

    const allowances = dto.allowances ?? payroll.details
      .filter((detail) => detail.type === DetailType.ALLOWANCE)
      .map((detail) => ({ label: detail.label, amount: Number(detail.amount) }));
    const { details, totalAllowances, totalDeductions, netSalary } = this.computePayroll(base, allowances);

    const detailRepo = this.repo.manager.getRepository(PayrollDetail);
    await detailRepo.delete({ payrollId: id });
    await detailRepo.save(details.map((detail) => detailRepo.create({ ...detail, payrollId: id })));

    await this.repo.update(id, {
      employeeId: dto.employeeId ?? payroll.employeeId,
      month: dto.month ?? payroll.month,
      year: dto.year ?? payroll.year,
      baseSalary: base,
      totalAllowances,
      totalDeductions,
      netSalary,
    });
    return this.findOne(id);
  }

  async validate(id: number) {
    const payroll = await this.findOne(id);
    if (payroll.status === PayrollStatus.ARCHIVED) {
      throw new BadRequestException('Une fiche archivee ne peut pas etre validee.');
    }
    await this.repo.update(id, { status: PayrollStatus.VALIDATED });
    return this.findOne(id);
  }

  async setStatus(id: number, status: PayrollStatus) {
    const payroll = await this.findOne(id);
    if (payroll.status === PayrollStatus.PAID && status === PayrollStatus.ARCHIVED) {
      throw new BadRequestException('Une fiche payee ne peut pas etre archivee.');
    }
    await this.repo.update(id, { status });
    return this.findOne(id);
  }

  async toggleStatus(id: number) {
    const payroll = await this.findOne(id);
    const nextStatus = payroll.status === PayrollStatus.ARCHIVED ? PayrollStatus.DRAFT : PayrollStatus.ARCHIVED;
    return this.setStatus(id, nextStatus);
  }

  async remove(id: number) {
    const payroll = await this.findOne(id);
    if ([PayrollStatus.VALIDATED, PayrollStatus.PAID].includes(payroll.status)) {
      throw new BadRequestException('Une fiche de paie validee ou payee ne peut pas etre supprimee.');
    }
    await this.repo.update(id, { status: PayrollStatus.ARCHIVED });
    return { message: 'Fiche de paie archivee' };
  }

  async getMonthlySummary(month: number, year: number, companyId?: number) {
    const qb = this.repo.createQueryBuilder('p')
      .leftJoin('p.employee', 'e')
      .where('p.month = :month AND p.year = :year', { month, year })
      .andWhere('p.status != :archived', { archived: PayrollStatus.ARCHIVED });

    if (companyId) qb.andWhere('e.companyId = :companyId', { companyId });

    const payrolls = await qb.getMany();
    const totalMasse = payrolls.reduce((sum, payroll) => sum + Number(payroll.netSalary), 0);
    const totalBrut = payrolls.reduce((sum, payroll) => sum + Number(payroll.baseSalary) + Number(payroll.totalAllowances), 0);
    const totalDeductions = payrolls.reduce((sum, payroll) => sum + Number(payroll.totalDeductions), 0);
    return { month, year, count: payrolls.length, totalMasse, totalBrut, totalDeductions };
  }

  private computePayroll(base: number, allowances: { label: string; amount: number }[]) {
    const cnss = base * RATES.CNSS;
    const ipr = base * RATES.IPR;
    const inpp = base * RATES.INPP;
    const onem = base * RATES.ONEM;
    const details: Partial<PayrollDetail>[] = [
      { label: 'CNSS (5%)', type: DetailType.DEDUCTION, amount: cnss, rate: RATES.CNSS * 100 },
      { label: 'IPR (15%)', type: DetailType.DEDUCTION, amount: ipr, rate: RATES.IPR * 100 },
      { label: 'INPP (2%)', type: DetailType.DEDUCTION, amount: inpp, rate: RATES.INPP * 100 },
      { label: 'ONEM (1%)', type: DetailType.DEDUCTION, amount: onem, rate: RATES.ONEM * 100 },
      ...allowances.map((allowance) => ({
        label: allowance.label,
        type: DetailType.ALLOWANCE,
        amount: Number(allowance.amount),
      })),
    ];
    const totalDeductions = cnss + ipr + inpp + onem;
    const totalAllowances = allowances.reduce((sum, allowance) => sum + Number(allowance.amount), 0);
    const netSalary = base + totalAllowances - totalDeductions;
    return { details, totalAllowances, totalDeductions, netSalary };
  }
}
