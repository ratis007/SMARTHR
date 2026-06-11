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

  @Column({ name: 'employee_id' })
  employeeId: number;

  @Column()
  month: number;

  @Column()
  year: number;

  @Column({ name: 'base_salary', type: 'decimal', precision: 15, scale: 2, default: 0 })
  baseSalary: number;

  @Column({ name: 'total_allowances', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalAllowances: number;

  @Column({ name: 'total_deductions', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalDeductions: number;

  @Column({ name: 'net_salary', type: 'decimal', precision: 15, scale: 2, default: 0 })
  netSalary: number;

  @Column({ type: 'enum', enum: PayrollStatus, default: PayrollStatus.DRAFT })
  status: PayrollStatus;

  @OneToMany(() => PayrollDetail, (d) => d.payroll, { cascade: true })
  details: PayrollDetail[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
