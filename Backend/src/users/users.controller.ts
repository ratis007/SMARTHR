import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto, UpdateUserDto } from './dto/update-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private service: UsersService) {}

  @Get()
  @RequirePermissions('users:read')
  findAll() { return this.service.findAll(); }

  @Get('roles')
  @RequirePermissions('users:read')
  findRoles() { return this.service.findRoles(); }

  @Get('permissions')
  @RequirePermissions('users:read')
  findPermissions() { return this.service.findPermissions(); }

  @Put('roles/:id')
  @RequirePermissions('users:write')
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.service.updateRole(+id, dto);
  }

  @Get('audit-logs')
  @RequirePermissions('audit:read')
  findAuditLogs(@Query('userId') userId?: string) {
    return this.service.findAuditLogs(userId ? +userId : undefined);
  }

  @Get(':id')
  @RequirePermissions('users:read')
  findOne(@Param('id') id: string) { return this.service.findOne(+id); }

  @Post()
  @RequirePermissions('users:write')
  create(@Body() dto: CreateUserDto) { return this.service.create(dto); }

  @Put(':id')
  @RequirePermissions('users:write')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) { return this.service.update(+id, dto); }

  @Patch(':id/status')
  @RequirePermissions('users:write')
  setStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.service.setStatus(+id, status);
  }

  @Post(':id/reset-password')
  @RequirePermissions('users:write')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.service.resetPassword(+id, dto.password);
  }

  @Delete(':id')
  @RequirePermissions('users:write')
  remove(@Param('id') id: string) { return this.service.remove(+id); }
}
