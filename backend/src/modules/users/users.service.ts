import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User } from './schemas/user.schema';
import { Role } from '../roles/schemas/role.schema';
import { AuditService } from '../audit/audit.service';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { Paginated, makePaginated } from '../../common/dto/pagination.dto';
import { toCsv } from '../../common/utils/csv.util';
import {
  ChangePasswordDto,
  CreateUserDto,
  UpdateUserDto,
} from './dto/user.dto';

export interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  sort?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
    private readonly auditService: AuditService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) throw new NotFoundException('User not found');
    const role = await this.roleModel.findOne({ key: user.role }).lean().exec();
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      roleName: role?.name ?? user.role,
      permissions: role?.permissions ?? [],
      status: user.status,
      emailVerified: user.emailVerified,
      timezone: user.timezone ?? null,
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateUserDto, actor: JwtUser) {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: dto }, { new: true })
      .lean()
      .exec();
    if (!user) throw new NotFoundException('User not found');
    await this.auditService.record({
      action: 'user.profile.update',
      entityType: 'User',
      entityId: userId,
      description: `Updated own profile`,
      actor,
    });
    return this.getProfile(userId);
  }

  async changePassword(userId: string, dto: ChangePasswordDto, actor: JwtUser) {
    const user = await this.userModel.findById(userId).select('+passwordHash').exec();
    if (!user) throw new NotFoundException('User not found');
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');
    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await user.save();
    await this.auditService.record({
      action: 'user.password.change',
      entityType: 'User',
      entityId: userId,
      description: 'Changed own password',
      actor,
    });
    return { message: 'Password updated' };
  }

  async list(query: UserListQuery): Promise<Paginated<Record<string, unknown>>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;
    if (query.search) {
      const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const sort = this.parseSort(query.sort);
    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    const data = users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      emailVerified: u.emailVerified,
      lastLoginAt: u.lastLoginAt ?? null,
      createdAt: u.createdAt,
    }));

    return makePaginated(data, page, limit, total);
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('User not found');
    const user = await this.userModel.findById(id).lean().exec();
    if (!user) throw new NotFoundException('User not found');
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async create(dto: CreateUserDto, actor: JwtUser) {
    const role = await this.roleModel.findOne({ key: dto.role }).lean().exec();
    if (!role) throw new BadRequestException('Invalid role');

    const exists = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .lean()
      .exec();
    if (exists) throw new ConflictException('An account with this email already exists');

    const created = await this.userModel.create({
      name: dto.name.trim(),
      email: dto.email.toLowerCase(),
      passwordHash: await bcrypt.hash(dto.password, 10),
      role: dto.role,
      status: dto.status ?? 'active',
      emailVerified: true,
      createdBy: new Types.ObjectId(actor.id),
      timezone: dto.timezone ?? null,
    });

    await this.auditService.record({
      action: 'user.create',
      entityType: 'User',
      entityId: String(created._id),
      description: `Created user ${created.email} with role ${dto.role}`,
      actor,
    });

    return this.findById(String(created._id));
  }

  async update(id: string, dto: UpdateUserDto, actor: JwtUser) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('User not found');
    const target = await this.userModel.findById(id).lean().exec();
    if (!target) throw new NotFoundException('User not found');

    const updated = await this.userModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .lean()
      .exec();

    await this.auditService.record({
      action: 'user.update',
      entityType: 'User',
      entityId: id,
      description: `Updated user ${target.email}`,
      metadata: { fields: Object.keys(dto) },
      actor,
    });
    return this.findById(String(updated!._id));
  }

  async setStatus(id: string, status: string, actor: JwtUser) {
    const target = await this.requireUser(id);
    if (String(target._id) === actor.id && status !== 'active') {
      throw new BadRequestException('You cannot change your own account status');
    }
    await this.userModel.updateOne({ _id: id }, { $set: { status } }).exec();
    await this.auditService.record({
      action: 'user.status.update',
      entityType: 'User',
      entityId: id,
      description: `Set status of ${target.email} to ${status}`,
      actor,
    });
    return this.findById(id);
  }

  async setRole(id: string, roleKey: string, actor: JwtUser) {
    const role = await this.roleModel.findOne({ key: roleKey }).lean().exec();
    if (!role) throw new BadRequestException('Invalid role');
    const target = await this.requireUser(id);
    if (String(target._id) === actor.id && roleKey !== 'admin') {
      throw new BadRequestException('You cannot remove your own administrator role');
    }
    await this.userModel.updateOne({ _id: id }, { $set: { role: roleKey } }).exec();
    await this.auditService.record({
      action: 'user.role.update',
      entityType: 'User',
      entityId: id,
      description: `Changed role of ${target.email} to ${role.name}`,
      actor,
    });
    return this.findById(id);
  }

  async remove(id: string, actor: JwtUser) {
    const target = await this.requireUser(id);
    if (String(target._id) === actor.id) {
      throw new BadRequestException('You cannot delete your own account');
    }
    if (target.role === 'super_admin') {
      throw new ForbiddenException('Super admin accounts cannot be deleted');
    }
    await this.userModel.deleteOne({ _id: id }).exec();
    await this.auditService.record({
      action: 'user.delete',
      entityType: 'User',
      entityId: id,
      description: `Deleted user ${target.email}`,
      actor,
    });
    return { message: 'User deleted' };
  }

  async activity(id: string, limit = 10) {
    return this.auditService.activityForUser(id, limit);
  }

  async toCsv(query: UserListQuery): Promise<string> {
    const result = await this.list({ ...query, page: 1, limit: 100 });
    return toCsv(result.data);
  }

  private async requireUser(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('User not found');
    const user = await this.userModel.findById(id).lean().exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private parseSort(sort?: string): Record<string, 1 | -1> {
    if (!sort) return { createdAt: -1 };
    const [field, dir] = sort.split(':');
    const allowed = ['name', 'email', 'role', 'status', 'createdAt', 'lastLoginAt'];
    if (!allowed.includes(field)) return { createdAt: -1 };
    return { [field]: dir === 'asc' ? 1 : -1 };
  }
}