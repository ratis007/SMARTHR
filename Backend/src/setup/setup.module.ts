import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from '../users/permission.entity';
import { Role } from '../users/role.entity';
import { User } from '../users/user.entity';
import { SetupController } from './setup.controller';
import { SetupRateLimitGuard } from './setup-rate-limit.guard';
import { SetupService } from './setup.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission])],
  controllers: [SetupController],
  providers: [SetupService, SetupRateLimitGuard],
})
export class SetupModule {}
