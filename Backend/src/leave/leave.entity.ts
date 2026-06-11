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

  @Column({ name: 'employee_id' })
  employeeId: number;

  @Column({ type: 'enum', enum: LeaveType })
  type: LeaveType;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ nullable: true })
  reason: string;

  @Column({ type: 'enum', enum: LeaveStatus, default: LeaveStatus.PENDING })
  status: LeaveStatus;

  @Column({ nullable: true })
  days: number;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
