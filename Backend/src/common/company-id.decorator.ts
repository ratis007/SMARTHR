import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extrait le companyId depuis le header X-Company-ID.
 * Retourne undefined si absent (mode global sans filtre entreprise).
 */
export const CompanyId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const raw = request.headers['x-company-id'];
    if (!raw) return undefined;
    const id = parseInt(raw, 10);
    return isNaN(id) ? undefined : id;
  },
);
