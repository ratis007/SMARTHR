import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './contract.entity';
import { CreateContractDto } from './dto/create-contract.dto';

@Injectable()
export class ContractsService {
  constructor(@InjectRepository(Contract) private repo: Repository<Contract>) {}

  findAll(employeeId?: number, companyId?: number) {
    const qb = this.repo.createQueryBuilder('c')
      .leftJoinAndSelect('c.employee', 'e');

    if (employeeId) qb.andWhere('c.employeeId = :employeeId', { employeeId });
    // Filtre via companyId (vraie FK sur la table employees)
    if (companyId)  qb.andWhere('e.companyId = :companyId', { companyId });

    return qb.orderBy('c.createdAt', 'DESC').getMany();
  }

  async findOne(id: number) {
    const c = await this.repo.findOne({ where: { id }, relations: ['employee'] });
    if (!c) throw new NotFoundException('Contrat non trouvé');
    return c;
  }

  create(dto: CreateContractDto) { return this.repo.save(this.repo.create(dto)); }

  async update(id: number, dto: Partial<CreateContractDto>) {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { message: 'Contrat supprimé' };
  }
}
