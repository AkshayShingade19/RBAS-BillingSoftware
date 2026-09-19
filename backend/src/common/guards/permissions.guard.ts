import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { JwtUser } from '../decorators/current-user.decorator';
import { PERMISSIONS_KEY, ROLES_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requestedRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request & { user: JwtUser }>();
    const user = request.user;

    if (requestedRoles?.length) {
      if (!user || !requestedRoles.includes(user.role)) {
        throw new ForbiddenException('You do not have permission to perform this action');
      }
    }

    const requestedPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requestedPermissions?.length) {
      if (!user) throw new ForbiddenException('Authentication required');
      const granted = user.permissions ?? [];
      const ok = requestedPermissions.every((p) => granted.includes('*') || granted.includes(p));
      if (!ok) {
        throw new ForbiddenException('You do not have permission to perform this action');
      }
    }

    return true;
  }
}