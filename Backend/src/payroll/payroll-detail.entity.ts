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

  @Column()
  payrollId: number;

  @Column()
  label: string; // CNSS, IPR, Prime transport, etc.

  @Column({ type: 'enum', enum: DetailType })
  type: DetailType;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  rate: number; // taux en %
}
