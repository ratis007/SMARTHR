import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, Unique,
} from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { PayrollDetail } from './payroll-detail.entity';

export enum PayrollStatus { DRAFT = 'draft', VALIDATED = 'validated', PAID = 'paid' }

@Entity('payrolls')
@Unique(['employeeId', 'month', 'year']) // Bug 1 fix: empêche double paie
export class Payroll {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column()
  employeeId: number;

  @Column()
  month: number;

  @Column()
  year: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  baseSalary: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalAllowances: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalDeductions: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  netSalary: number;

  @Column({ type: 'enum', enum: PayrollStatus, default: PayrollStatus.DRAFT })
  status: PayrollStatus;

  @OneToMany(() => PayrollDetail, (d) => d.payroll, { cascade: true })
  details: PayrollDetail[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
