import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface PayrollBatchQueuePayload {
  jobId: number;
  employeeIds: number[];
  dto: any;
  user?: any;
  ipAddress?: string;
}

type PayrollBatchProcessor = (payload: PayrollBatchQueuePayload) => Promise<void>;

@Injectable()
export class PayrollBatchQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(PayrollBatchQueueService.name);
  private readonly driver = (process.env.PAYROLL_BATCH_QUEUE_DRIVER || 'memory').toLowerCase();
  private readonly queueName = process.env.PAYROLL_BATCH_QUEUE_NAME || 'payroll-generation';
  private processor?: PayrollBatchProcessor;
  private queue: any;
  private worker: any;

  registerProcessor(processor: PayrollBatchProcessor) {
    this.processor = processor;
    if (this.driver === 'bullmq') this.ensureBullMq();
  }

  async enqueue(payload: PayrollBatchQueuePayload) {
    if (this.driver === 'bullmq') {
      this.ensureBullMq();
      await this.queue.add('generate', payload, {
        attempts: Number(process.env.PAYROLL_BATCH_QUEUE_ATTEMPTS || 1),
        removeOnComplete: true,
        removeOnFail: false,
      });
      return;
    }

    setTimeout(() => {
      this.processor?.(payload).catch((error) => {
        this.logger.error(`Payroll batch job ${payload.jobId} failed`, error?.stack || error?.message);
      });
    }, 0);
  }

  async onModuleDestroy() {
    await this.worker?.close?.();
    await this.queue?.close?.();
  }

  private ensureBullMq() {
    if (!this.processor) throw new Error('Payroll batch processor is not registered');
    if (this.queue && this.worker) return;

    let bullmq: any;
    try {
      bullmq = require('bullmq');
    } catch (error) {
      throw new Error('PAYROLL_BATCH_QUEUE_DRIVER=bullmq requires the bullmq package to be installed');
    }

    const connection = {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
    };

    this.queue = new bullmq.Queue(this.queueName, { connection });
    this.worker = new bullmq.Worker(
      this.queueName,
      async (job: any) => this.processor(job.data),
      { connection },
    );
  }
}
