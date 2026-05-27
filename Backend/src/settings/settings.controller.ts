import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  @Get('rates')
  getRates() {
    // Taux légaux RDC - configurables
    return {
      cnss: 5,    // %
      ipr: 15,    // %
      inpp: 2,    // %
      onem: 1,    // %
      currency: 'CDF',
    };
  }
}
