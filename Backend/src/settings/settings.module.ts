import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { CompanySetting } from './company-setting.entity';
import { CurrencySetting } from './currency-setting.entity';
import { ExchangeRateHistory } from './exchange-rate.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CompanySetting, CurrencySetting, ExchangeRateHistory])],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
