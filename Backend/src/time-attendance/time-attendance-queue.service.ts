import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface TimeAttendanceQueuePayload {
  jobId: number;
  action: 'calculate' | 'detect_alerts' | 'dispatch_notifications';
  companyId: number;
  dto: any;
  user?: any;
  ipAddress?: string;
}

type TimeAttendanceProcessor = (payload: TimeAttendanceQueuePayload) => Promise<void>;

@Injectable()
export class TimeAttendanceQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(TimeAttendanceQueueService.name);
  private readonly driver = (process.env.TIME_ATTENDANCE_QUEUE_DRIVER || 'memory').toLowerCase();
  private readonly queueName = process.env.TIME_ATTENDANCE_QUEUE_NAME || 'time-attendance-processing';
  private processor?: TimeAttendanceProcessor;
  private queue: any;
  private worker: any;

  registerProcessor(processor: TimeAttendanceProcessor) {
    this.processor = processor;
    if (this.driver === 'bullmq') this.ensureBullMq();
  }

  async enqueue(payload: TimeAttendanceQueuePayload) {
    if (this.driver === 'bullmq') {
      this.ensureBullMq();
      await this.queue.add(payload.action, payload, {
        attempts: Number(process.env.TIME_ATTENDANCE_QUEUE_ATTEMPTS || 1),
        removeOnComplete: true,
        removeOnFail: false,
      });
      return;
    }

    setTimeout(() => {
      this.processor?.(payload).catch((error) => {
        this.logger.error(`Time attendance job ${payload.jobId} failed`, error?.stack || error?.message);
      });
    }, 0);
  }

  async onModuleDestroy() {
    await this.worker?.close?.();
    await this.queue?.close?.();
  }

  private ensureBullMq() {
    if (!this.processor) throw new Error('Time attendance processor is not registered');
    if (this.queue && this.worker) return;

    let bullmq: any;
    try {
      bullmq = require('bullmq');
    } catch (_error) {
      throw new Error('TIME_ATTENDANCE_QUEUE_DRIVER=bullmq requires the bullmq package to be installed');
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
