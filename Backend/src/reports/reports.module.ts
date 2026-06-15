import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Employee } from '../employees/employee.entity';
import { Payroll } from '../payroll/payroll.entity';
import { Leave } from '../leave/leave.entity';
import { Company } from '../companies/company.entity';
import { Contract } from '../contracts/contract.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, Payroll, Leave, Company, Contract])],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
