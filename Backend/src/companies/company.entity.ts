import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Employee } from '../employees/employee.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  rccm: string; // Registre du Commerce

  @Column({ name: 'id_nat', nullable: true })
  idNat: string; // Identification Nationale

  @Column({ name: 'tax_number', nullable: true })
  taxNumber: string; // Numéro fiscal

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => Employee, (emp) => emp.company)
  employees: Employee[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
