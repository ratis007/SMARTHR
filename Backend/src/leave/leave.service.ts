import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Leave, LeaveStatus } from './leave.entity';
import { Employee } from '../employees/employee.entity';
import { CreateLeaveDto } from './dto/create-leave.dto';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(Leave)     private repo: Repository<Leave>,
    @InjectRepository(Employee)  private empRepo: Repository<Employee>,
  ) {}

  findAll(employeeId?: number, page = 1, limit = 1000, companyId?: number) {
    const qb = this.repo.createQueryBuilder('l')
      .leftJoinAndSelect('l.employee', 'e')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('l.createdAt', 'DESC');

    if (employeeId) qb.andWhere('l.employeeId = :employeeId', { employeeId });
    // Filtre via companyId (vraie FK sur la table employees)
    if (companyId)  qb.andWhere('e.companyId = :companyId', { companyId });

    return qb.getMany();
  }

  async findOne(id: number) {
    const l = await this.repo.findOne({ where: { id }, relations: ['employee'] });
    if (!l) throw new NotFoundException('Demande de congé non trouvée');
    return l;
  }

  async create(dto: CreateLeaveDto) {
    const employee = await this.empRepo.findOne({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException(`Employé ID ${dto.employeeId} non trouvé`);

    const start = new Date(dto.startDate);
    const end   = new Date(dto.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()))
      throw new BadRequestException('Dates invalides');
    if (start > end)
      throw new BadRequestException('La date de début doit être antérieure à la date de fin');

    const overlap = await this.repo.createQueryBuilder('l')
      .where('l.employeeId = :empId', { empId: dto.employeeId })
      .andWhere('l.status != :rejected', { rejected: LeaveStatus.REJECTED })
      .andWhere('l.startDate <= :end AND l.endDate >= :start', { start: dto.startDate, end: dto.endDate })
      .getOne();

    if (overlap)
      throw new ConflictException(
        `${employee.lastName} a déjà un congé sur cette période (${overlap.startDate} → ${overlap.endDate})`
      );

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return this.repo.save(this.repo.create({ ...dto, days } as any));
  }

  async approve(id: number, userId: number) {
    const leave = await this.findOne(id);
    if (leave.status !== LeaveStatus.PENDING)
      throw new BadRequestException('Seules les demandes en attente peuvent être approuvées');
    await this.repo.update(id, { status: LeaveStatus.APPROVED, approvedBy: userId });
    return this.findOne(id);
  }

  async reject(id: number) {
    const leave = await this.findOne(id);
    if (leave.status !== LeaveStatus.PENDING)
      throw new BadRequestException('Seules les demandes en attente peuvent être refusées');
    await this.repo.update(id, { status: LeaveStatus.REJECTED });
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { message: 'Demande supprimée' };
  }

  getPending(companyId?: number) {
    const qb = this.repo.createQueryBuilder('l')
      .leftJoinAndSelect('l.employee', 'e')
      .where('l.status = :status', { status: LeaveStatus.PENDING })
      .orderBy('l.createdAt', 'ASC');

    if (companyId) qb.andWhere('e.companyId = :companyId', { companyId });
    return qb.getMany();
  }

  async getStats(employeeId: number) {
    const all = await this.repo.find({ where: { employeeId } });
    return {
      total:    all.length,
      approved: all.filter(l => l.status === LeaveStatus.APPROVED).length,
      pending:  all.filter(l => l.status === LeaveStatus.PENDING).length,
      rejected: all.filter(l => l.status === LeaveStatus.REJECTED).length,
    };
  }
}
