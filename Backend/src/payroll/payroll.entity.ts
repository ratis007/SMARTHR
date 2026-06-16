import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, Unique,
} from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { PayrollDetail } from './payroll-detail.entity';

export enum PayrollStatus {
  DRAFT = 'draft',
  PREPARATION = 'preparation',
  REVIEW = 'review',
  VALIDATED = 'validated',
  CLOSED = 'closed',
  PAID = 'paid',
  ARCHIVED = 'archived',
}

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

  @Column({ name: 'gross_salary', type: 'decimal', precision: 15, scale: 2, default: 0 })
  grossSalary: number;

  @Column({ name: 'taxable_salary', type: 'decimal', precision: 15, scale: 2, default: 0 })
  taxableSalary: number;

  @Column({ name: 'net_fiscal', type: 'decimal', precision: 15, scale: 2, default: 0 })
  netFiscal: number;

  @Column({ name: 'employer_contributions', type: 'decimal', precision: 15, scale: 2, default: 0 })
  employerContributions: number;

  @Column({ name: 'net_salary', type: 'decimal', precision: 15, scale: 2, default: 0 })
  netSalary: number;

  @Column({ default: 'CDF' })
  currency: string;

  @Column({ name: 'exchange_rate', type: 'decimal', precision: 15, scale: 4, default: 1 })
  exchangeRate: number;

  @Column({ name: 'workflow_step', default: 'draft' })
  workflowStep: string;

  @Column({ name: 'calculation_snapshot', type: 'jsonb', nullable: true })
  calculationSnapshot: any;

  @Column({ type: 'enum', enum: PayrollStatus, default: PayrollStatus.DRAFT })
  status: PayrollStatus;

  @OneToMany(() => PayrollDetail, (d) => d.payroll, { cascade: true })
  details: PayrollDetail[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
