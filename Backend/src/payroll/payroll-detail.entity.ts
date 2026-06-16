import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
} from 'typeorm';
import { Payroll } from './payroll.entity';

export enum DetailType { ALLOWANCE = 'allowance', DEDUCTION = 'deduction' }

@Entity('payroll_details')
export class PayrollDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Payroll, (p) => p.details)
  @JoinColumn({ name: 'payroll_id' })
  payroll: Payroll;

  @Column({ name: 'payroll_id' })
  payrollId: number;

  @Column()
  label: string; // CNSS, IPR, Prime transport, etc.

  @Column({ nullable: true })
  code: string;

  @Column({ nullable: true })
  category: string;

  @Column({ type: 'enum', enum: DetailType })
  type: DetailType;

  @Column({ name: 'base_amount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  baseAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ name: 'employer_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  employerAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  rate: number; // taux en %

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;
}
