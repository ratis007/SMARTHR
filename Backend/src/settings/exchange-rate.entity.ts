import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('exchange_rate_history')
export class ExchangeRateHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'company_id' })
  companyId: number;

  @Column({ name: 'from_currency' })
  fromCurrency: string;

  @Column({ name: 'to_currency' })
  toCurrency: string;

  @Column({ type: 'decimal', precision: 15, scale: 4 })
  rate: number;

  @Column({ default: 'manual' })
  source: string;

  @CreateDateColumn({ name: 'effective_at' })
  effectiveAt: Date;
}
