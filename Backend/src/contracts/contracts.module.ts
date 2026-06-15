import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { Contract } from './contract.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Contract])],
  providers: [ContractsService],
  controllers: [ContractsController],
})
export class ContractsModule {}
