import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { Employee } from './employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(@InjectRepository(Employee) private repo: Repository<Employee>) {}

  // Bug 6 fix: pagination + recherche
  async findAll(companyId?: number, page = 1, limit = 1000, search?: string) {
    const qb = this.repo.createQueryBuilder('e')
      .leftJoinAndSelect('e.company', 'company')
      .take(limit)
      .skip((page - 1) * limit)
      .orderBy('e.lastName', 'ASC');

    if (companyId) qb.andWhere('e.companyId = :companyId', { companyId });
    if (search) {
      qb.andWhere(
        '(e.lastName ILIKE :s OR e.firstName ILIKE :s OR e.matricule ILIKE :s OR e.department ILIKE :s)',
        { s: `%${search}%` }
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: number) {
    const e = await this.repo.findOne({ where: { id }, relations: ['company', 'contracts'] });
    if (!e) throw new NotFoundException('Employé non trouvé');
    return e;
  }

  async create(dto: CreateEmployeeDto) {
    if (!dto.matricule) {
      const count = await this.repo.count();
      dto.matricule = `EMP${String(count + 1).padStart(5, '0')}`;
    }
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: number, dto: Partial<CreateEmployeeDto>) {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { message: 'Employé supprimé' };
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
}
