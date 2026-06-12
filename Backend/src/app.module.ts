import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { EmployeesModule } from './employees/employees.module';
import { PayrollModule } from './payroll/payroll.module';
import { LeaveModule } from './leave/leave.module';
import { ContractsModule } from './contracts/contracts.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const sslMode = config.get<string>('DB_SSL');
        const ssl =
          sslMode === 'true'
            ? { rejectUnauthorized: false }
            : sslMode === 'false'
              ? false
              : databaseUrl
                ? { rejectUnauthorized: false }
                : false;

        return {
          type: 'postgres',
          ...(databaseUrl
            ? { url: databaseUrl }
            : {
                host: config.get('DB_HOST', 'localhost'),
                port: config.get<number>('DB_PORT', 5432),
                username: config.get('DB_USERNAME', 'postgres'),
                password: config.get('DB_PASSWORD', 'password'),
                database: config.get<string>('DB_NAME', 'smarthr_db'),
              }),
          ssl,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: false,
          logging: ['error', 'warn'],
        } as TypeOrmModuleOptions;
      },
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    CompaniesModule,
    EmployeesModule,
    PayrollModule,
    LeaveModule,
    ContractsModule,
    ReportsModule,
    SettingsModule,
  ],
})
export class AppModule {}
