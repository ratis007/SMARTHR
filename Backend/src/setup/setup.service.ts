import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'crypto';
import { User } from '../users/user.entity';
import { Role } from '../users/role.entity';
import { Permission } from '../users/permission.entity';
import { CreateAdminSetupDto } from './dto/create-admin-setup.dto';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);
  private readonly adminRoleNames = ['super_admin', 'admin'];

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
    @InjectRepository(Permission) private readonly permissionsRepo: Repository<Permission>,
  ) {}

  async getStatus() {
    const adminExists = await this.adminExists();

    return {
      allowAdminSetup: this.isAdminSetupAllowed(),
      adminExists,
      setupCompleted: adminExists,
    };
  }

  async createAdmin(dto: CreateAdminSetupDto) {
    this.logger.warn('[SETUP] Admin creation requested');

    if (!this.isAdminSetupAllowed()) {
      throw new ForbiddenException('Admin setup disabled');
    }

    this.validateSetupToken(dto.setupToken);
    this.logger.warn('[SETUP] Token validated');

    const normalizedEmail = dto.email.trim().toLowerCase();
    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const { saved, superAdminRole } = await this.usersRepo.manager.transaction(
      'SERIALIZABLE',
      async (manager) => {
        await manager.query("SELECT pg_advisory_xact_lock(hashtext('smarthr_initial_admin_setup'))");

        if (await this.adminExists(manager)) {
          throw new ConflictException('Setup already completed');
        }

        const usersRepo = manager.getRepository(User);
        const existingUser = await usersRepo.findOne({ where: { email: normalizedEmail } });
        if (existingUser) {
          throw new ConflictException('Email already used');
        }

        const role = await this.getOrCreateSuperAdminRole(manager);
        const user = usersRepo.create({
          email: normalizedEmail,
          password: hashedPassword,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          status: 'active',
          isActive: true,
          emailVerified: true,
          roles: [role],
        });

        return {
          saved: await usersRepo.save(user),
          superAdminRole: role,
        };
      },
    );

    this.logger.warn('[SETUP] First administrator created');
    this.logger.warn('[SETUP] Setup disabled');

    return {
      message: 'First administrator created',
      user: {
        id: saved.id,
        email: saved.email,
        firstName: saved.firstName,
        lastName: saved.lastName,
        roles: [superAdminRole.name],
        isActive: saved.isActive,
        emailVerified: saved.emailVerified,
        status: saved.status,
      },
    };
  }

  private isAdminSetupAllowed(): boolean {
    return this.config.get<string>('ALLOW_ADMIN_SETUP') === 'true';
  }

  private validateSetupToken(setupToken: string) {
    const expectedToken = this.config.get<string>('ADMIN_SETUP_TOKEN');
    if (!expectedToken || !this.tokensMatch(setupToken, expectedToken)) {
      throw new ForbiddenException('Invalid setup token');
    }
  }

  private tokensMatch(received: string, expected: string): boolean {
    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);

    if (receivedBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(receivedBuffer, expectedBuffer);
  }

  private async adminExists(manager?: EntityManager): Promise<boolean> {
    const usersRepo = manager?.getRepository(User) || this.usersRepo;
    const count = await usersRepo
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role')
      .where('LOWER(role.name) IN (:...roles)', { roles: this.adminRoleNames })
      .getCount();

    return count > 0;
  }

  private async getOrCreateSuperAdminRole(manager?: EntityManager): Promise<Role> {
    const rolesRepo = manager?.getRepository(Role) || this.rolesRepo;
    const permissionsRepo = manager?.getRepository(Permission) || this.permissionsRepo;
    const existing = await rolesRepo.findOne({
      where: { name: 'super_admin' },
      relations: ['permissions'],
    });
    if (existing) return existing;

    const permissions = await permissionsRepo.find();
    return rolesRepo.save(rolesRepo.create({
      name: 'super_admin',
      description: 'Super Administrateur',
      permissions,
    }));
  }
}
