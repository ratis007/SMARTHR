import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../employees/employee.entity';
import { AuditLog } from '../users/audit-log.entity';
import { TimeAttendanceController } from './time-attendance.controller';
import { TimeAttendanceQueueService } from './time-attendance-queue.service';
import { TimeAttendanceService } from './time-attendance.service';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, AuditLog])],
  controllers: [TimeAttendanceController],
  providers: [TimeAttendanceService, TimeAttendanceQueueService],
})
export class TimeAttendanceModule {}
