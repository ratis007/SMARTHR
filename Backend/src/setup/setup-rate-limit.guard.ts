import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class SetupRateLimitGuard implements CanActivate {
  private readonly attempts = new Map<string, RateLimitBucket>();
  private readonly maxAttempts = 5;
  private readonly windowMs = 60 * 60 * 1000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = this.getClientKey(request);
    const now = Date.now();
    const bucket = this.attempts.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (bucket.count >= this.maxAttempts) {
      throw new HttpException('Too many setup attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    bucket.count += 1;
    this.attempts.set(key, bucket);
    return true;
  }

  private getClientKey(request: any): string {
    const forwardedFor = request.headers?.['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0]?.trim();

    return ip || request.ip || request.socket?.remoteAddress || 'unknown';
  }
}
