import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { Payroll } from './payroll.entity';
import { PayrollDetail } from './payroll-detail.entity';
import { Employee } from '../employees/employee.entity';
import { PayrollEngineService } from './payroll-engine.service';
import { AuditLog } from '../users/audit-log.entity';
import { PayrollBatchQueueService } from './payroll-batch-queue.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payroll, PayrollDetail, Employee, AuditLog])],
  providers: [PayrollService, PayrollEngineService, PayrollBatchQueueService],
  controllers: [PayrollController],
})
export class PayrollModule {}
