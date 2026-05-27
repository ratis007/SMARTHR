import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Employee } from '../employees/employee.entity';

export enum LeaveStatus { PENDING = 'pending', APPROVED = 'approved', REJECTED = 'rejected' }
export enum LeaveType { ANNUAL = 'annual', SICK = 'sick', MATERNITY = 'maternity', PATERNITY = 'paternity', UNPAID = 'unpaid', OTHER = 'other' }

@Entity('leave_requests')
export class Leave {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column()
  employeeId: number;

  @Column({ type: 'enum', enum: LeaveType })
  type: LeaveType;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ nullable: true })
  reason: string;

  @Column({ type: 'enum', enum: LeaveStatus, default: LeaveStatus.PENDING })
  status: LeaveStatus;

  @Column({ nullable: true })
  days: number;

  @Column({ nullable: true })
  approvedBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
