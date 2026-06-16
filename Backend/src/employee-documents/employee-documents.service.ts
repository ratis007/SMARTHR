import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource, Repository } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { AuditLog } from '../users/audit-log.entity';
import { EmployeeDocument, EmployeeDocumentType } from './employee-document.entity';
import { createZip } from './zip.util';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_EXTENSIONS = new Map([
  ['.pdf', 'application/pdf'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.doc', 'application/msword'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
]);

const DOCUMENT_LABELS: Record<EmployeeDocumentType, string> = {
  [EmployeeDocumentType.CONTRACT]: 'Contrat de travail',
  [EmployeeDocumentType.DIPLOMA]: 'Diplome',
  [EmployeeDocumentType.ID_CARD]: "Carte d'identite",
  [EmployeeDocumentType.CV]: 'CV',
  [EmployeeDocumentType.OTHER]: 'Autre document',
};

@Injectable()
export class EmployeeDocumentsService implements OnModuleInit {
  readonly maxFileSizeBytes: number;
  private readonly uploadRoot: string;

  constructor(
    @InjectRepository(EmployeeDocument) private repo: Repository<EmployeeDocument>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private config: ConfigService,
    private dataSource: DataSource,
  ) {
    const maxMb = Number(this.config.get('EMPLOYEE_DOCUMENT_MAX_SIZE_MB', 10));
    this.maxFileSizeBytes = Math.max(1, maxMb) * 1024 * 1024;
    this.uploadRoot = path.resolve(this.config.get('EMPLOYEE_DOCUMENT_STORAGE_PATH', path.join(process.cwd(), 'uploads', 'employee-documents')));
    fs.mkdirSync(this.uploadRoot, { recursive: true });
  }

  async onModuleInit() {
    await this.ensureSchema();
  }

  getConfig() {
    return {
      maxFileSizeBytes: this.maxFileSizeBytes,
      maxFileSizeMb: Math.round(this.maxFileSizeBytes / 1024 / 1024),
      allowedExtensions: Array.from(ALLOWED_EXTENSIONS.keys()),
      documentTypes: Object.entries(DOCUMENT_LABELS).map(([value, label]) => ({ value, label })),
    };
  }

  async list(employeeId: number) {
    await this.ensureEmployee(employeeId);
    const documents = await this.repo.find({ where: { employeeId }, order: { createdAt: 'DESC' } });
    return documents.map(this.serialize);
  }

  async upload(employeeId: number, documentType: EmployeeDocumentType, file: any, user: any, ipAddress?: string) {
    await this.ensureEmployee(employeeId);
    this.validateDocumentType(documentType);
    this.validateFile(file);

    const stored = this.storeFile(employeeId, file);
    const document = await this.repo.save(this.repo.create({
      employeeId,
      documentType,
      fileName: file.originalname,
      originalName: file.originalname,
      filePath: stored.relativePath,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedBy: user?.id,
    }));

    await this.audit(user?.id, 'employee_document_uploaded', document.id, ipAddress, {
      employeeId,
      documentType,
      fileName: document.fileName,
      fileSize: document.fileSize,
    });

    return this.serialize(document);
  }

  async download(employeeId: number, documentId: number, user: any, ipAddress?: string) {
    const document = await this.findForEmployee(employeeId, documentId);
    const absolutePath = this.resolveStoredPath(document.filePath);
    if (!fs.existsSync(absolutePath)) throw new NotFoundException('Fichier introuvable sur le stockage');

    await this.audit(user?.id, 'employee_document_downloaded', document.id, ipAddress, {
      employeeId,
      fileName: document.fileName,
    });

    return { document, absolutePath };
  }

  async replace(employeeId: number, documentId: number, documentType: EmployeeDocumentType, file: any, user: any, ipAddress?: string) {
    const document = await this.findForEmployee(employeeId, documentId);
    if (documentType) this.validateDocumentType(documentType);
    this.validateFile(file);

    const previousPath = document.filePath;
    const stored = this.storeFile(employeeId, file);
    document.documentType = documentType || document.documentType;
    document.fileName = file.originalname;
    document.originalName = file.originalname;
    document.filePath = stored.relativePath;
    document.fileSize = file.size;
    document.mimeType = file.mimetype;
    document.uploadedBy = user?.id;

    const saved = await this.repo.save(document);
    this.deleteStoredFile(previousPath);

    await this.audit(user?.id, 'employee_document_replaced', saved.id, ipAddress, {
      employeeId,
      documentType: saved.documentType,
      fileName: saved.fileName,
      fileSize: saved.fileSize,
    });

    return this.serialize(saved);
  }

  async remove(employeeId: number, documentId: number, user: any, ipAddress?: string) {
    const document = await this.findForEmployee(employeeId, documentId);
    await this.repo.remove(document);
    this.deleteStoredFile(document.filePath);

    await this.audit(user?.id, 'employee_document_deleted', documentId, ipAddress, {
      employeeId,
      fileName: document.fileName,
      documentType: document.documentType,
    });

    return { message: 'Document supprime' };
  }

  async exportZip(employeeId: number, user: any, ipAddress?: string) {
    await this.ensureEmployee(employeeId);
    const documents = await this.repo.find({ where: { employeeId }, order: { createdAt: 'ASC' } });
    if (!documents.length) throw new NotFoundException('Aucun document a exporter');

    const entries = documents.map((document) => {
      const absolutePath = this.resolveStoredPath(document.filePath);
      if (!fs.existsSync(absolutePath)) return null;
      return {
        name: `${DOCUMENT_LABELS[document.documentType] || 'Document'}/${document.id}-${this.safeDownloadName(document.fileName)}`,
        data: fs.readFileSync(absolutePath),
        date: document.updatedAt || document.createdAt,
      };
    }).filter(Boolean) as Array<{ name: string; data: Buffer; date?: Date }>;

    if (!entries.length) throw new NotFoundException('Aucun fichier disponible sur le stockage');
    const zip = createZip(entries);

    await this.audit(user?.id, 'employee_documents_exported', employeeId, ipAddress, {
      employeeId,
      count: entries.length,
    });

    return zip;
  }

  private async ensureEmployee(employeeId: number) {
    const employee = await this.employeeRepo.findOne({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employe non trouve');
    return employee;
  }

  private async findForEmployee(employeeId: number, documentId: number) {
    await this.ensureEmployee(employeeId);
    const document = await this.repo.findOne({ where: { id: documentId, employeeId } });
    if (!document) throw new NotFoundException('Document introuvable');
    return document;
  }

  private validateDocumentType(documentType: EmployeeDocumentType) {
    if (!Object.values(EmployeeDocumentType).includes(documentType)) {
      throw new BadRequestException('Type de document invalide');
    }
  }

  private validateFile(file: any) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    if (file.size > this.maxFileSizeBytes) throw new BadRequestException(`Le fichier depasse la taille maximale de ${this.getConfig().maxFileSizeMb} Mo`);

    const ext = path.extname(file.originalname || '').toLowerCase();
    const expectedMime = ALLOWED_EXTENSIONS.get(ext);
    if (!expectedMime || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Format non autorise. Formats acceptes : PDF, JPG, PNG, DOC, DOCX.');
    }

    if ((ext === '.jpg' || ext === '.jpeg') && file.mimetype !== 'image/jpeg') throw new BadRequestException('Extension et type MIME incoherents');
    if (ext === '.png' && file.mimetype !== 'image/png') throw new BadRequestException('Extension et type MIME incoherents');
    if (ext === '.pdf' && file.mimetype !== 'application/pdf') throw new BadRequestException('Extension et type MIME incoherents');
  }

  private storeFile(employeeId: number, file: any) {
    const ext = path.extname(file.originalname).toLowerCase();
    const employeeDir = path.join(this.uploadRoot, String(employeeId));
    fs.mkdirSync(employeeDir, { recursive: true });

    const storedName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`;
    const absolutePath = path.join(employeeDir, storedName);
    fs.writeFileSync(absolutePath, file.buffer);

    return { relativePath: path.join(String(employeeId), storedName) };
  }

  private resolveStoredPath(relativePath: string) {
    const absolutePath = path.resolve(this.uploadRoot, relativePath);
    const relative = path.relative(this.uploadRoot, absolutePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new ForbiddenException('Chemin de fichier invalide');
    return absolutePath;
  }

  private deleteStoredFile(relativePath: string) {
    try {
      const absolutePath = this.resolveStoredPath(relativePath);
      if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    } catch {
      return;
    }
  }

  private safeDownloadName(name: string) {
    return (name || 'document').replace(/[^\w.\-() ]+/g, '_').slice(0, 180);
  }

  private async audit(userId: number, action: string, entityId: number, ipAddress: string, details: any) {
    await this.auditRepo.save(this.auditRepo.create({
      userId,
      action,
      entity: 'employee_documents',
      entityId,
      ipAddress,
      details,
    }));
  }

  private async ensureSchema() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS employee_documents (
        id SERIAL PRIMARY KEY,
        employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
        document_type VARCHAR(50) DEFAULT 'other',
        file_name VARCHAR(255),
        original_name VARCHAR(255),
        file_path VARCHAR(500),
        file_size BIGINT DEFAULT 0,
        mime_type VARCHAR(150),
        uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await this.dataSource.query(`ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) DEFAULT 'other'`);
    await this.dataSource.query(`ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)`);
    await this.dataSource.query(`ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS original_name VARCHAR(255)`);
    await this.dataSource.query(`ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS file_path VARCHAR(500)`);
    await this.dataSource.query(`ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0`);
    await this.dataSource.query(`ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(150)`);
    await this.dataSource.query(`ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS uploaded_by INT REFERENCES users(id) ON DELETE SET NULL`);
    await this.dataSource.query(`ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
    await this.dataSource.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'employee_documents' AND column_name = 'name'
        ) THEN
          UPDATE employee_documents SET file_name = COALESCE(file_name, name, 'document') WHERE file_name IS NULL;
        ELSE
          UPDATE employee_documents SET file_name = COALESCE(file_name, 'document') WHERE file_name IS NULL;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'employee_documents' AND column_name = 'type'
        ) THEN
          UPDATE employee_documents SET document_type = COALESCE(document_type, type, 'other') WHERE document_type IS NULL;
        ELSE
          UPDATE employee_documents SET document_type = COALESCE(document_type, 'other') WHERE document_type IS NULL;
        END IF;
      END $$
    `);
    await this.dataSource.query(`UPDATE employee_documents SET file_path = 'missing' WHERE file_path IS NULL`);
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_employee_documents_employee_id ON employee_documents(employee_id)`);
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_employee_documents_created_at ON employee_documents(created_at)`);
  }

  private serialize(document: EmployeeDocument) {
    return {
      id: document.id,
      employeeId: document.employeeId,
      documentType: document.documentType,
      type: document.documentType,
      typeLabel: DOCUMENT_LABELS[document.documentType] || 'Document',
      fileName: document.fileName,
      name: document.fileName,
      fileSize: Number(document.fileSize || 0),
      mimeType: document.mimeType,
      uploadedBy: document.uploadedBy,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }
}
