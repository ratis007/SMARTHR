import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SettingsService } from './settings.service';
import { CompanySettingDto, CurrencySettingDto } from './dto/company-setting.dto';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings')
export class SettingsController {
  constructor(private service: SettingsService) {}

  @Get('rates')
  @RequirePermissions('settings:read')
  getRates() { return this.service.getLegalRates(); }

  @Get('companies/:companyId')
  @RequirePermissions('settings:read')
  findCompanySettings(@Param('companyId') companyId: string, @Query('type') type?: string) {
    return this.service.findCompanySettings(+companyId, type);
  }

  @Post('companies/:companyId')
  @RequirePermissions('settings:write')
  createCompanySetting(@Param('companyId') companyId: string, @Body() dto: CompanySettingDto) {
    return this.service.createCompanySetting(+companyId, dto);
  }

  @Put('company-settings/:id')
  @RequirePermissions('settings:write')
  updateCompanySetting(@Param('id') id: string, @Body() dto: CompanySettingDto) {
    return this.service.updateCompanySetting(+id, dto);
  }

  @Delete('company-settings/:id')
  @RequirePermissions('settings:write')
  removeCompanySetting(@Param('id') id: string) {
    return this.service.removeCompanySetting(+id);
  }

  @Get('companies/:companyId/currency')
  @RequirePermissions('currency:read')
  getCurrency(@Param('companyId') companyId: string) {
    return this.service.getCurrency(+companyId);
  }

  @Put('companies/:companyId/currency')
  @RequirePermissions('currency:write')
  updateCurrency(@Param('companyId') companyId: string, @Body() dto: CurrencySettingDto) {
    return this.service.updateCurrency(+companyId, dto);
  }

  @Post('companies/:companyId/currency/fetch-rate')
  @RequirePermissions('currency:write')
  fetchCurrencyRate(@Param('companyId') companyId: string) {
    return this.service.fetchAndUpdateUsdCdfRate(+companyId);
  }

  @Get('companies/:companyId/currency/convert')
  @RequirePermissions('currency:read')
  convert(@Param('companyId') companyId: string, @Query('amount') amount: string, @Query('from') from = 'USD') {
    return this.service.convert(+companyId, Number(amount), from);
  }

  @Get('companies/:companyId/currency/history')
  @RequirePermissions('currency:read')
  getRateHistory(@Param('companyId') companyId: string) {
    return this.service.getRateHistory(+companyId);
  }
}
