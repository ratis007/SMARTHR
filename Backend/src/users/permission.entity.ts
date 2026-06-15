import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string; // e.g. employees:read, payroll:write

  @Column({ nullable: true })
  module: string; // employees, payroll, leave, etc.
}
