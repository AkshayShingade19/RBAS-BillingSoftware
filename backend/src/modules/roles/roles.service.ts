import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from './schemas/role.schema';
import { ROLE_DEFINITIONS } from './permissions.constants';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
    private readonly auditService: AuditService,
  ) {}

  async ensureSeedRoles(): Promise<void> {
    for (const def of ROLE_DEFINITIONS) {
      const exists = await this.roleModel.findOne({ key: def.key }).lean().exec();
      if (!exists) {
        await this.roleModel.create(def);
      }
    }
  }

  async list() {
    const roles = await this.roleModel.find().sort({ isSystem: -1, key: 1 }).lean().exec();
    return roles.map((r) => ({
      id: String(r._id),
      key: r.key,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      isSystem: r.isSystem,
    }));
  }

  async update(key: string, permissions: string[], actor: JwtUser) {
    const role = await this.roleModel.findOne({ key }).exec();
    if (!role) throw new NotFoundException('Role not found');
    role.permissions = permissions;
    await role.save();
    await this.auditService.record({
      action: 'role.update',
      entityType: 'Role',
      entityId: key,
      description: `Updated permissions for role ${role.name}`,
      actor,
    });
    return this.list();
  }
}