import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';

@Injectable()
export class CompaniesService {
  constructor(@InjectRepository(Company) private repo: Repository<Company>) {}

  findAll() { return this.repo.find(); }

  async findOne(id: number) {
    const c = await this.repo.findOne({ where: { id }, relations: ['employees'] });
    if (!c) throw new NotFoundException('Entreprise non trouvée');
    return c;
  }

  create(dto: CreateCompanyDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: number, dto: Partial<CreateCompanyDto>) {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { message: 'Entreprise supprimée' };
  }
}
