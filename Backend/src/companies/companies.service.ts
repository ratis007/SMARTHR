import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Company } from './company.entity';
import { CreateCompanyDto } from './dto/create-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company) private repo: Repository<Company>,
    private dataSource: DataSource,
  ) {}

  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number) {
    const company = await this.repo.findOne({ where: { id }, relations: ['employees'] });
    if (!company) throw new NotFoundException('Entreprise non trouvee');
    return company;
  }

  create(dto: CreateCompanyDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: number, dto: Partial<CreateCompanyDto>) {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async setActive(id: number, isActive: boolean) {
    await this.findOne(id);
    await this.repo.update(id, { isActive });
    return this.findOne(id);
  }

  async toggleStatus(id: number) {
    const company = await this.findOne(id);
    await this.repo.update(id, { isActive: !company.isActive });
    return this.findOne(id);
  }

  async archive(id: number) {
    await this.setActive(id, false);
    return { message: 'Entreprise archivee' };
  }

  async remove(id: number) {
    await this.findOne(id);
    const [{ count: payrollCount }] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM payrolls p
       INNER JOIN employees e ON e.id = p.employee_id
       WHERE e.company_id = $1`,
      [id],
    );
    const [{ count: employeeCount }] = await this.dataSource.query(
      'SELECT COUNT(*)::int AS count FROM employees WHERE company_id = $1',
      [id],
    );

    if (Number(payrollCount) > 0) {
      throw new BadRequestException(
        "Suppression definitive bloquee: cette entreprise possede un historique de paie. Archivez-la pour conserver l'integrite des donnees.",
      );
    }
    if (Number(employeeCount) > 0) {
      throw new BadRequestException(
        "Suppression definitive bloquee: cette entreprise possede encore des employes lies. Archivez-la ou transferez les donnees avant suppression.",
      );
    }

    await this.repo.delete(id);
    return { message: 'Entreprise supprimee definitivement' };
  }
}
