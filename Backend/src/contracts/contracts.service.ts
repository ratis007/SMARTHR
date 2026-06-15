import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Contract, ContractStatus } from './contract.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract) private repo: Repository<Contract>,
    private dataSource: DataSource,
  ) {}

  findAll(employeeId?: number, companyId?: number) {
    const qb = this.repo.createQueryBuilder('c')
      .leftJoinAndSelect('c.employee', 'e');

    if (employeeId) qb.andWhere('c.employeeId = :employeeId', { employeeId });
    if (companyId) qb.andWhere('e.companyId = :companyId', { companyId });

    return qb.orderBy('c.createdAt', 'DESC').getMany();
  }

  async findOne(id: number) {
    const contract = await this.repo.findOne({ where: { id }, relations: ['employee'] });
    if (!contract) throw new NotFoundException('Contrat non trouve');
    return contract;
  }

  create(dto: CreateContractDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: number, dto: UpdateContractDto) {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async setStatus(id: number, status: ContractStatus) {
    await this.findOne(id);
    await this.repo.update(id, { status });
    return this.findOne(id);
  }

  async toggleStatus(id: number) {
    const contract = await this.findOne(id);
    const nextStatus = contract.status === ContractStatus.ACTIVE
      ? ContractStatus.TERMINATED
      : ContractStatus.ACTIVE;
    return this.setStatus(id, nextStatus);
  }

  async remove(id: number) {
    const contract = await this.findOne(id);
    const [{ count }] = await this.dataSource.query(
      "SELECT COUNT(*)::int AS count FROM payrolls WHERE employee_id = $1 AND status IN ('validated', 'paid')",
      [contract.employeeId],
    );

    if (contract.status === ContractStatus.ACTIVE && Number(count) > 0) {
      throw new BadRequestException("Impossible de supprimer un contrat actif lie a un historique de paie valide.");
    }

    await this.repo.update(id, { status: ContractStatus.TERMINATED });
    return { message: 'Contrat archive' };
  }
}
