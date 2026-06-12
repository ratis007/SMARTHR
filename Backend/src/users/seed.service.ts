import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Permission) private permRepo: Repository<Permission>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedPermissions();
    await this.seedRoles();
    await this.seedAdminUser();
  }

  private async seedPermissions() {
    const modules = {
      users: ['read', 'write'],
      companies: ['read', 'write'],
      employees: ['read', 'write'],
      contracts: ['read', 'write'],
      payroll: ['read', 'write'],
      leave: ['read', 'write', 'approve'],
      reports: ['read'],
      settings: ['read', 'write'],
      currency: ['read', 'write'],
      audit: ['read'],
    };
    for (const [module, actions] of Object.entries(modules)) {
      for (const action of actions) {
        const name = `${module}:${action}`;
        const exists = await this.permRepo.findOne({ where: { name } });
        if (!exists) await this.permRepo.save(this.permRepo.create({ name, module }));
      }
    }
  }

  private async seedRoles() {
    const allPerms = await this.permRepo.find();
    const roleDefs = [
      { name: 'super_admin', description: 'Super Administrateur', perms: allPerms.map((p) => p.name) },
      { name: 'admin', description: 'Administrateur', perms: allPerms.map((p) => p.name) },
      { name: 'supervisor', description: 'Superviseur', perms: ['employees:read', 'contracts:read', 'payroll:read', 'leave:read', 'reports:read', 'settings:read'] },
      { name: 'agent', description: 'Agent', perms: ['employees:read', 'employees:write', 'leave:read', 'leave:write'] },
      { name: 'company', description: 'Entreprise', perms: ['employees:read', 'contracts:read', 'payroll:read', 'leave:read', 'reports:read', 'settings:read'] },
      { name: 'support_tech', description: 'Support Technique', perms: ['users:read', 'companies:read', 'settings:read', 'audit:read'] },
      { name: 'rh_manager', description: 'Responsable RH', perms: ['employees:read', 'employees:write', 'leave:read', 'leave:write', 'leave:approve', 'contracts:read', 'reports:read'] },
      { name: 'accountant', description: 'Comptable / Paie', perms: ['payroll:read', 'payroll:write', 'employees:read', 'reports:read'] },
      { name: 'employee', description: 'Employe standard', perms: ['leave:read', 'leave:write'] },
    ];

    for (const def of roleDefs) {
      let role = await this.roleRepo.findOne({ where: { name: def.name }, relations: ['permissions'] });
      if (!role) role = this.roleRepo.create({ name: def.name, description: def.description });
      role.description = def.description;
      role.permissions = allPerms.filter((p) => def.perms.includes(p.name));
      await this.roleRepo.save(role);
    }
  }

  private async seedAdminUser() {
    const exists = await this.userRepo.findOne({ where: { email: 'admin@smarthr.com' }, relations: ['roles'] });
    const adminRole = await this.roleRepo.findOne({ where: { name: 'super_admin' } });
    const hashed = await bcrypt.hash('SmartHR@2026', 12);
    if (!exists) {
      const user = this.userRepo.create({
        email: 'admin@smarthr.com',
        password: hashed,
        firstName: 'Admin',
        lastName: 'SmartHR',
        status: 'active',
        isActive: true,
        roles: adminRole ? [adminRole] : [],
      });
      await this.userRepo.save(user);
      this.logger.log('Utilisateur admin cree: admin@smarthr.com / SmartHR@2026');
      return;
    }
    exists.password = hashed;
    exists.status = exists.status || 'active';
    exists.isActive = exists.status === 'active';
    if (adminRole && (!exists.roles || !exists.roles.some((r) => r.name === 'super_admin'))) {
      exists.roles = [...(exists.roles || []), adminRole];
    }
    await this.userRepo.save(exists);
    this.logger.log('Mot de passe admin reinitialise: admin@smarthr.com / SmartHR@2026');
  }
}
