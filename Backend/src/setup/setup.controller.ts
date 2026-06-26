import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { CreateAdminSetupDto } from './dto/create-admin-setup.dto';
import { SetupRateLimitGuard } from './setup-rate-limit.guard';
import { SetupService } from './setup.service';

@ApiTags('Initial Setup')
@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get initial setup status',
    description: 'Returns non-sensitive setup state without exposing the setup token.',
  })
  @ApiOkResponse({
    description: 'Setup status.',
    schema: {
      example: {
        allowAdminSetup: true,
        adminExists: false,
        setupCompleted: false,
      },
    },
  })
  status() {
    return this.setupService.getStatus();
  }

  @Post('admin')
  @UseGuards(SetupRateLimitGuard)
  @ApiOperation({
    summary: 'Create the first Super Administrator',
    description: 'Creates the first administrator only when ALLOW_ADMIN_SETUP=true, no administrator exists, and the setup token is valid.',
  })
  @ApiBody({
    type: CreateAdminSetupDto,
    examples: {
      createFirstAdmin: {
        summary: 'Create first Super Administrator',
        value: {
          setupToken: 'render-secret-token',
          firstName: 'Marie',
          lastName: 'Admin',
          email: 'admin@example.com',
          password: 'Str0ng!Password',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'First administrator created.',
    schema: {
      example: {
        message: 'First administrator created',
        user: {
          id: 1,
          email: 'admin@example.com',
          firstName: 'Marie',
          lastName: 'Admin',
          roles: ['super_admin'],
          isActive: true,
          emailVerified: true,
          status: 'active',
        },
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'Admin setup disabled or invalid token.',
    schema: {
      examples: {
        disabled: { value: { message: 'Admin setup disabled' } },
        invalidToken: { value: { message: 'Invalid setup token' } },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Setup already completed or email already exists.',
    schema: {
      examples: {
        completed: { value: { message: 'Setup already completed' } },
        email: { value: { message: 'Email already used' } },
      },
    },
  })
  @ApiTooManyRequestsResponse({
    description: 'More than 5 setup attempts from the same client in one hour.',
  })
  @ApiResponse({ status: 400, description: 'Invalid request payload.' })
  createAdmin(@Body() dto: CreateAdminSetupDto) {
    return this.setupService.createAdmin(dto);
  }
}
