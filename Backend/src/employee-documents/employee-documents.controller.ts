import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { EmployeeDocumentType } from './employee-document.entity';
import { EmployeeDocumentsService } from './employee-documents.service';

const uploadLimits = {
  fileSize: Math.max(1, Number(process.env.EMPLOYEE_DOCUMENT_MAX_SIZE_MB || 10)) * 1024 * 1024,
};

@ApiTags('Employee documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('employees/:employeeId/documents')
export class EmployeeDocumentsController {
  constructor(private service: EmployeeDocumentsService) {}

  @Get('config')
  @RequirePermissions('employees:read')
  getConfig() {
    return this.service.getConfig();
  }

  @Get()
  @RequirePermissions('employees:read')
  list(@Param('employeeId') employeeId: string) {
    return this.service.list(+employeeId);
  }

  @Post()
  @RequirePermissions('employees:write')
  @UseInterceptors(FileInterceptor('file', { limits: uploadLimits }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        documentType: { type: 'string', enum: Object.values(EmployeeDocumentType) },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  upload(
    @Param('employeeId') employeeId: string,
    @Body('documentType') documentType: EmployeeDocumentType,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    return this.service.upload(+employeeId, documentType, file, req.user, req.ip);
  }

  @Get('export')
  @RequirePermissions('employees:read')
  @Header('Content-Type', 'application/zip')
  async exportZip(@Param('employeeId') employeeId: string, @Req() req: any, @Res() res: Response) {
    const zip = await this.service.exportZip(+employeeId, req.user, req.ip);
    res.setHeader('Content-Disposition', `attachment; filename="employee-${employeeId}-documents.zip"`);
    res.send(zip);
  }

  @Get(':documentId/download')
  @RequirePermissions('employees:read')
  async download(
    @Param('employeeId') employeeId: string,
    @Param('documentId') documentId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { document, absolutePath } = await this.service.download(+employeeId, +documentId, req.user, req.ip);
    res.download(absolutePath, document.fileName);
  }

  @Put(':documentId')
  @RequirePermissions('employees:write')
  @UseInterceptors(FileInterceptor('file', { limits: uploadLimits }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        documentType: { type: 'string', enum: Object.values(EmployeeDocumentType) },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  replace(
    @Param('employeeId') employeeId: string,
    @Param('documentId') documentId: string,
    @Body('documentType') documentType: EmployeeDocumentType,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    return this.service.replace(+employeeId, +documentId, documentType, file, req.user, req.ip);
  }

  @Delete(':documentId')
  @RequirePermissions('employees:write')
  remove(@Param('employeeId') employeeId: string, @Param('documentId') documentId: string, @Req() req: any) {
    return this.service.remove(+employeeId, +documentId, req.user, req.ip);
  }
}
