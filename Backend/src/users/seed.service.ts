import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
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
    const perms = [
      { name: 'users:read', module: 'users' }, { name: 'users:write', module: 'users' },
      { name: 'employees:read', module: 'employees' }, { name: 'employees:write', module: 'employees' },
      { name: 'payroll:read', module: 'payroll' }, { name: 'payroll:write', module: 'payroll' },
      { name: 'leave:read', module: 'leave' }, { name: 'leave:write', module: 'leave' }, { name: 'leave:approve', module: 'leave' },
      { name: 'companies:read', module: 'companies' }, { name: 'companies:write', module: 'companies' },
      { name: 'reports:read', module: 'reports' },
    ];
    for (const p of perms) {
      const exists = await this.permRepo.findOne({ where: { name: p.name } });
      if (!exists) await this.permRepo.save(this.permRepo.create(p));
    }
  }

  private async seedRoles() {
    const allPerms = await this.permRepo.find();
    const rolesData = [
      { name: 'admin', description: 'Administrateur système', permNames: allPerms.map(p => p.name) },
      { name: 'rh_manager', description: 'Responsable RH', permNames: ['employees:read','employees:write','leave:read','leave:write','leave:approve','contracts:read','reports:read'] },
      { name: 'accountant', description: 'Comptable / Paie', permNames: ['payroll:read','payroll:write','employees:read','reports:read'] },
      { name: 'employee', description: 'Employé standard', permNames: ['leave:read','leave:write'] },
    ];
    for (const rd of rolesData) {
      let role = await this.roleRepo.findOne({ where: { name: rd.name }, relations: ['permissions'] });
      if (!role) {
        role = this.roleRepo.create({ name: rd.name, description: rd.description });
        role.permissions = allPerms.filter(p => rd.permNames.includes(p.name));
        await this.roleRepo.save(role);
        this.logger.log(`Rôle créé: ${rd.name}`);
      }
    }
  }

  private async seedAdminUser() {
    const exists = await this.userRepo.findOne({ where: { email: 'admin@smarthr.com' }, relations: ['roles'] });
    if (!exists) {
      const adminRole = await this.roleRepo.findOne({ where: { name: 'admin' } });
      const hashed = await bcrypt.hash('SmartHR@2026', 12);
      const user = this.userRepo.create({
        email: 'admin@smarthr.com',
        password: hashed,
        firstName: 'Admin',
        lastName: 'SmartHR',
        roles: adminRole ? [adminRole] : [],
      });
      await this.userRepo.save(user);
      this.logger.log('Utilisateur admin créé: admin@smarthr.com / SmartHR@2026');
    } else {
      // Réinitialiser le mot de passe à chaque démarrage pour garantir l'accès
      const hashed = await bcrypt.hash('SmartHR@2026', 12);
      exists.password = hashed;
      if (!exists.roles || exists.roles.length === 0) {
        const adminRole = await this.roleRepo.findOne({ where: { name: 'admin' } });
        if (adminRole) exists.roles = [adminRole];
      }
      await this.userRepo.save(exists);
      this.logger.log('Mot de passe admin réinitialisé: admin@smarthr.com / SmartHR@2026');
    }
  }
}
