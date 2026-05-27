import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Employee } from '../employees/employee.entity';

export enum ContractType { CDI = 'CDI', CDD = 'CDD', STAGE = 'STAGE', CONSULTANT = 'CONSULTANT' }
export enum ContractStatus { ACTIVE = 'active', EXPIRED = 'expired', TERMINATED = 'terminated' }

@Entity('contracts')
export class Contract {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Employee, (emp) => emp.contracts)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column()
  employeeId: number;

  @Column({ type: 'enum', enum: ContractType })
  type: ContractType;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date', nullable: true })
  endDate: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  salary: number;

  @Column({ type: 'enum', enum: ContractStatus, default: ContractStatus.ACTIVE })
  status: ContractStatus;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
