import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('currency_settings')
export class CurrencySetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id', unique: true })
  companyId: number;

  @Column({ name: 'primary_currency', default: 'CDF' })
  primaryCurrency: string;

  @Column({ name: 'secondary_currency', default: 'USD' })
  secondaryCurrency: string;

  @Column({ name: 'usd_to_cdf_rate', type: 'decimal', precision: 15, scale: 4, default: 2850 })
  usdToCdfRate: number;

  @Column({ name: 'rate_source', default: 'manual' })
  rateSource: string;

  @Column({ name: 'rounding_mode', default: 'nearest' })
  roundingMode: string;

  @Column({ name: 'rounding_precision', default: 2 })
  roundingPrecision: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
