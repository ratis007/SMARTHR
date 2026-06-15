import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Identifiants invalides');
    if (!user.isActive || user.status !== 'active') throw new UnauthorizedException('Compte inactif ou suspendu');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Identifiants invalides');
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    await this.usersService.updateLastLogin(user.id);
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles.map((r) => r.name),
      permissions: Array.from(new Set(user.roles.flatMap((r) => (r.permissions || []).map((p) => p.name)))),
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        permissions: Array.from(new Set(user.roles.flatMap((r) => (r.permissions || []).map((p) => p.name)))),
      },
    };
  }
}
