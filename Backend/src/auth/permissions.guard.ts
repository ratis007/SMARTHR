import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ANY_REQUIRED_PERMISSIONS_KEY, REQUIRED_PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const anyRequired = this.reflector.getAllAndOverride<string[]>(ANY_REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length && !anyRequired?.length) return true;

    const user = context.switchToHttp().getRequest().user;
    const roles = user?.roles || [];
    if (roles.includes('super_admin') || roles.includes('admin')) return true;

    const permissions = new Set(user?.permissions || []);
    const requiredAllowed = !required?.length || required.every((permission) => permissions.has(permission));
    const anyAllowed = !anyRequired?.length || anyRequired.some((permission) => permissions.has(permission));
    const allowed = requiredAllowed && anyAllowed;
    if (!allowed) throw new ForbiddenException('Permission insuffisante');
    return true;
  }
}
