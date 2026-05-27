import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Company } from '../companies/company.entity';
import { Contract } from '../contracts/contract.entity';

export enum Gender { MALE = 'M', FEMALE = 'F' }
export enum EmployeeStatus { ACTIVE = 'active', INACTIVE = 'inactive', SUSPENDED = 'suspended' }

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  matricule: string;

  @Column()
  lastName: string; // Nom

  @Column({ nullable: true })
  middleName: string; // Postnom

  @Column()
  firstName: string; // Prénom

  @Column({ type: 'date', nullable: true })
  birthDate: string;

  @Column({ nullable: true })
  nationality: string;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  position: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  baseSalary: number;

  @Column({ type: 'enum', enum: EmployeeStatus, default: EmployeeStatus.ACTIVE })
  status: EmployeeStatus;

  @ManyToOne(() => Company, (company) => company.employees)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ nullable: true })
  companyId: number;

  @OneToMany(() => Contract, (c) => c.employee)
  contracts: Contract[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
