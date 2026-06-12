import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { Role } from './role.entity';
import { Permission } from './permission.entity';
import { AuditLog } from './audit-log.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    @InjectRepository(Role) private rolesRepo: Repository<Role>,
    @InjectRepository(Permission) private permissionsRepo: Repository<Permission>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  findAll() {
    return this.repo.find({
      select: ['id', 'email', 'firstName', 'lastName', 'isActive', 'status', 'lastLogin', 'createdAt'],
      relations: ['roles'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const user = await this.repo.findOne({ where: { id }, relations: ['roles'] });
    if (!user) throw new NotFoundException('Utilisateur non trouve');
    return user;
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email }, relations: ['roles'] });
  }

  async create(dto: CreateUserDto) {
    const exists = await this.findByEmail(dto.email);
    if (exists) throw new ConflictException('Email deja utilise');
    const status = dto.status || 'active';
    const user = this.repo.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      status,
      isActive: status === 'active',
      password: await bcrypt.hash(dto.password, 10),
      roles: await this.resolveRoles(dto.roleIds),
    });
    const saved = await this.repo.save(user);
    await this.audit(saved.id, 'users:create', 'users', saved.id, { email: saved.email });
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateUserDto) {
    const user = await this.findOne(id);
    if (dto.email && dto.email !== user.email && await this.findByEmail(dto.email)) {
      throw new ConflictException('Email deja utilise');
    }
    user.email = dto.email ?? user.email;
    user.firstName = dto.firstName ?? user.firstName;
    user.lastName = dto.lastName ?? user.lastName;
    user.status = dto.status ?? user.status ?? 'active';
    user.isActive = user.status === 'active';
    if (dto.roleIds) user.roles = await this.resolveRoles(dto.roleIds);
    await this.repo.save(user);
    await this.audit(id, 'users:update', 'users', id, dto);
    return this.findOne(id);
  }

  async setStatus(id: number, status: string) {
    if (!['active', 'inactive', 'suspended'].includes(status)) {
      throw new BadRequestException('Statut invalide');
    }
    await this.findOne(id);
    await this.repo.update(id, { status, isActive: status === 'active' });
    await this.audit(id, `users:${status}`, 'users', id, { status });
    return this.findOne(id);
  }

  async resetPassword(id: number, password: string) {
    await this.findOne(id);
    await this.repo.update(id, { password: await bcrypt.hash(password, 10) });
    await this.audit(id, 'users:reset_password', 'users', id, {});
    return { message: 'Mot de passe reinitialise' };
  }

  updateLastLogin(id: number) {
    return this.repo.update(id, { lastLogin: new Date() });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.repo.delete(id);
    await this.audit(id, 'users:delete', 'users', id, {});
    return { message: 'Utilisateur supprime' };
  }

  findRoles() {
    return this.rolesRepo.find({ order: { name: 'ASC' } });
  }

  findPermissions() {
    return this.permissionsRepo.find({ order: { module: 'ASC', name: 'ASC' } });
  }

  async updateRole(id: number, dto: UpdateRoleDto) {
    const role = await this.rolesRepo.findOne({ where: { id }, relations: ['permissions'] });
    if (!role) throw new NotFoundException('Role non trouve');
    role.description = dto.description ?? role.description;
    role.permissions = dto.permissionIds?.length
      ? await this.permissionsRepo.find({ where: { id: In(dto.permissionIds) } })
      : [];
    await this.rolesRepo.save(role);
    await this.audit(null, 'roles:update_permissions', 'roles', id, {
      role: role.name,
      permissionIds: dto.permissionIds,
    });
    return this.rolesRepo.findOne({ where: { id }, relations: ['permissions'] });
  }

  findAuditLogs(userId?: number) {
    return this.auditRepo.find({
      where: userId ? { userId } : {},
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  private async resolveRoles(roleIds?: number[]) {
    if (!roleIds?.length) return [];
    return this.rolesRepo.find({ where: { id: In(roleIds) } });
  }

  private audit(userId: number | null, action: string, entity: string, entityId: number, details: any) {
    return this.auditRepo.save(this.auditRepo.create({ userId, action, entity, entityId, details }));
  }
}
