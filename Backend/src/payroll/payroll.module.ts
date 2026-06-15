import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { Payroll } from './payroll.entity';
import { PayrollDetail } from './payroll-detail.entity';
import { Employee } from '../employees/employee.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Payroll, PayrollDetail, Employee])],
  providers: [PayrollService],
  controllers: [PayrollController],
})
export class PayrollModule {}
