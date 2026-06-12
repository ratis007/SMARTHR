import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest().user;
    const roles = user?.roles || [];
    if (roles.includes('super_admin') || roles.includes('admin')) return true;

    const permissions = new Set(user?.permissions || []);
    const allowed = required.every((permission) => permissions.has(permission));
    if (!allowed) throw new ForbiddenException('Permission insuffisante');
    return true;
  }
}
