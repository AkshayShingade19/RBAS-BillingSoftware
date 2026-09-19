import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtUser } from '../decorators/current-user.decorator';
import { User } from '../../modules/users/schemas/user.schema';
import { Role } from '../../modules/roles/schemas/role.schema';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: JwtUser }>();
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!token) throw new UnauthorizedException('Missing authentication token');

    let payload: { sub: string; email: string; role: string; name: string; sessionId: string };
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.userModel.findById(payload.sub).lean().exec();
    if (!user) throw new UnauthorizedException('Account no longer exists');

    if (user.status === 'suspended') {
      throw new ForbiddenException('Account suspended. Contact an administrator.');
    }

    const role = await this.roleModel.findOne({ key: user.role }).lean().exec();
    const permissions = role?.permissions ?? [];

    request.user = {
      id: String(user._id),
      email: user.email,
      role: user.role,
      name: user.name,
      sessionId: payload.sessionId,
      permissions,
    };
    return true;
  }
}