import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanySetting } from './company-setting.entity';
import { CurrencySetting } from './currency-setting.entity';
import { ExchangeRateHistory } from './exchange-rate.entity';
import { CompanySettingDto, CurrencySettingDto } from './dto/company-setting.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(CompanySetting) private settingsRepo: Repository<CompanySetting>,
    @InjectRepository(CurrencySetting) private currencyRepo: Repository<CurrencySetting>,
    @InjectRepository(ExchangeRateHistory) private ratesRepo: Repository<ExchangeRateHistory>,
  ) {}

  getLegalRates() {
    return { cnss: 5, ipr: 15, inpp: 2, onem: 1, currency: 'CDF' };
  }

  findCompanySettings(companyId: number, settingType?: string) {
    return this.settingsRepo.find({
      where: { companyId, ...(settingType ? { settingType } : {}) },
      order: { settingType: 'ASC', name: 'ASC' },
    });
  }

  createCompanySetting(companyId: number, dto: CompanySettingDto) {
    return this.settingsRepo.save(this.settingsRepo.create({ companyId, ...dto }));
  }

  async updateCompanySetting(id: number, dto: Partial<CompanySettingDto>) {
    const item = await this.settingsRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Parametre non trouve');
    Object.assign(item, dto);
    return this.settingsRepo.save(item);
  }

  async removeCompanySetting(id: number) {
    const item = await this.settingsRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Parametre non trouve');
    await this.settingsRepo.delete(id);
    return { message: 'Parametre supprime' };
  }

  async getCurrency(companyId: number) {
    let setting = await this.currencyRepo.findOne({ where: { companyId } });
    if (!setting) {
      setting = await this.currencyRepo.save(this.currencyRepo.create({ companyId }));
      await this.recordRate(companyId, Number(setting.usdToCdfRate), 'manual');
    }
    return setting;
  }

  async updateCurrency(companyId: number, dto: CurrencySettingDto) {
    const current = await this.getCurrency(companyId);
    Object.assign(current, {
      primaryCurrency: dto.primaryCurrency ?? current.primaryCurrency,
      secondaryCurrency: dto.secondaryCurrency ?? current.secondaryCurrency,
      usdToCdfRate: dto.usdToCdfRate,
      rateSource: dto.rateSource ?? 'manual',
      roundingMode: dto.roundingMode ?? current.roundingMode,
      roundingPrecision: dto.roundingPrecision ?? current.roundingPrecision,
    });
    const saved = await this.currencyRepo.save(current);
    await this.recordRate(companyId, dto.usdToCdfRate, saved.rateSource);
    return saved;
  }

  async fetchAndUpdateUsdCdfRate(companyId: number) {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: any = await response.json();
      const rate = Number(data?.rates?.CDF);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('Taux CDF indisponible');
      const current = await this.getCurrency(companyId);
      return this.updateCurrency(companyId, {
        primaryCurrency: current.primaryCurrency,
        secondaryCurrency: current.secondaryCurrency,
        usdToCdfRate: rate,
        rateSource: 'api',
        roundingMode: current.roundingMode,
        roundingPrecision: current.roundingPrecision,
      });
    } catch (error) {
      throw new BadRequestException('Impossible de recuperer le taux automatique. Verifiez la connexion internet ou utilisez le taux manuel.');
    }
  }

  async convert(companyId: number, amount: number, from: string) {
    const setting = await this.getCurrency(companyId);
    const rate = Number(setting.usdToCdfRate);
    const usd = from === 'CDF' ? amount / rate : amount;
    const cdf = from === 'USD' ? amount * rate : amount;
    return {
      input: { amount, currency: from },
      rate,
      USD: this.round(usd, setting.roundingPrecision, setting.roundingMode),
      CDF: this.round(cdf, 0, setting.roundingMode),
    };
  }

  getRateHistory(companyId: number) {
    return this.ratesRepo.find({ where: { companyId }, order: { effectiveAt: 'DESC' }, take: 100 });
  }

  private recordRate(companyId: number, rate: number, source: string) {
    return this.ratesRepo.save(this.ratesRepo.create({
      companyId,
      fromCurrency: 'USD',
      toCurrency: 'CDF',
      rate,
      source,
    }));
  }

  private round(value: number, precision: number, mode: string) {
    const factor = Math.pow(10, precision);
    if (mode === 'up') return Math.ceil(value * factor) / factor;
    if (mode === 'down') return Math.floor(value * factor) / factor;
    return Math.round(value * factor) / factor;
  }
}
