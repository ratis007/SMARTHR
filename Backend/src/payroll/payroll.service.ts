import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Payroll, PayrollStatus } from './payroll.entity';
import { DetailType, PayrollDetail } from './payroll-detail.entity';
import { Employee } from '../employees/employee.entity';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { PayrollEngineService } from './payroll-engine.service';
import { CreateIprBracketDto, CreateLegalRateDto, CreatePayrollRubricDto, CreatePayrollTimeInputDto, CreatePayrollVariableDto, PayrollPreviewDto } from './dto/payroll-engine.dto';
import { AuditLog } from '../users/audit-log.entity';
import { GeneratePayrollBatchDto } from './dto/payroll-batch.dto';
import { PayrollPeriodDto } from './dto/payroll-period.dto';
import { PayrollBatchQueueService } from './payroll-batch-queue.service';

@Injectable()
export class PayrollService {
  private readonly payrollDocumentRoot = path.resolve(process.env.PAYROLL_DOCUMENT_STORAGE_PATH || path.join(process.cwd(), 'uploads', 'payroll-documents'));

  constructor(
    @InjectRepository(Payroll) private repo: Repository<Payroll>,
    @InjectRepository(Employee) private empRepo: Repository<Employee>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private engine: PayrollEngineService,
    private dataSource: DataSource,
    private batchQueue: PayrollBatchQueueService,
  ) {
    this.batchQueue.registerProcessor((payload) => this.processBatchJob(
      payload.jobId,
      payload.employeeIds,
      payload.dto,
      payload.user,
      payload.ipAddress,
    ));
    fs.mkdirSync(this.payrollDocumentRoot, { recursive: true });
  }

  findAll(month?: number, year?: number, page = 1, limit = 1000, companyId?: number) {
    const qb = this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.employee', 'e')
      .leftJoinAndSelect('p.details', 'd')
      .where('p.status != :archived', { archived: PayrollStatus.ARCHIVED })
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('p.createdAt', 'DESC');

    if (month) qb.andWhere('p.month = :month', { month });
    if (year) qb.andWhere('p.year = :year', { year });
    if (companyId) qb.andWhere('e.companyId = :companyId', { companyId });

    return qb.getMany();
  }

  async findOne(id: number) {
    const payroll = await this.repo.findOne({ where: { id }, relations: ['employee', 'details'] });
    if (!payroll) throw new NotFoundException('Fiche de paie non trouvee');
    return payroll;
  }

  async generate(dto: CreatePayrollDto, user?: any, ipAddress?: string) {
    const employee = await this.empRepo.findOne({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Employe non trouve');
    await this.assertPeriodOpen(employee.companyId, dto.month, dto.year);

    const existing = await this.repo.findOne({
      where: { employeeId: dto.employeeId, month: dto.month, year: dto.year },
    });
    if (existing) return this.findOne(existing.id);

    const base = dto.baseSalary ?? Number(employee.baseSalary);
    if (!base || base <= 0) {
      throw new BadRequestException(
        `Salaire de base invalide (${base} CDF) pour ${employee.lastName}. Veuillez definir un salaire avant de generer la paie.`,
      );
    }

    const calculation = await this.engine.compute({ ...dto, baseSalary: base });
    const payroll = await this.repo.save(this.repo.create({
      employeeId: dto.employeeId,
      month: dto.month,
      year: dto.year,
      baseSalary: calculation.baseSalary,
      totalAllowances: calculation.totalAllowances,
      totalDeductions: calculation.totalDeductions,
      grossSalary: calculation.grossSalary,
      taxableSalary: calculation.taxableSalary,
      netFiscal: calculation.netFiscal,
      employerContributions: calculation.employerContributions,
      netSalary: calculation.netSalary,
      currency: calculation.currency,
      exchangeRate: calculation.exchangeRate,
      workflowStep: PayrollStatus.DRAFT,
      calculationSnapshot: calculation.snapshot,
    }));

    const detailRepo = this.repo.manager.getRepository(PayrollDetail);
    await detailRepo.save(calculation.details.map((detail) => ({ ...detail, payrollId: payroll.id }) as any));
    await this.audit(user?.id, 'payroll:generate', payroll.id, ipAddress, {
      employeeId: payroll.employeeId,
      month: payroll.month,
      year: payroll.year,
      netSalary: payroll.netSalary,
      grossSalary: payroll.grossSalary,
    });
    return this.findOne(payroll.id);
  }

  async update(id: number, dto: UpdatePayrollDto, user?: any, ipAddress?: string) {
    const payroll = await this.findOne(id);
    await this.assertPeriodOpen(payroll.employee?.companyId, dto.month ?? payroll.month, dto.year ?? payroll.year);
    if (payroll.status !== PayrollStatus.DRAFT) {
      throw new BadRequestException('Seules les fiches de paie brouillon peuvent etre modifiees.');
    }

    const base = dto.baseSalary !== undefined ? Number(dto.baseSalary) : Number(payroll.baseSalary);
    if (!base || base <= 0) throw new BadRequestException('Salaire de base invalide.');

    const allowances = dto.allowances ?? payroll.details
      .filter((detail) => detail.type === DetailType.ALLOWANCE)
      .filter((detail) => detail.metadata?.source === 'manual_variable' || !detail.code || detail.code === 'VARIABLE')
      .map((detail) => ({ label: detail.label, amount: Number(detail.amount) }));
    const calculation = await this.engine.compute({
      employeeId: dto.employeeId ?? payroll.employeeId,
      month: dto.month ?? payroll.month,
      year: dto.year ?? payroll.year,
      baseSalary: base,
      allowances,
    });

    const detailRepo = this.repo.manager.getRepository(PayrollDetail);
    await detailRepo.delete({ payrollId: id });
    await detailRepo.save(calculation.details.map((detail) => ({ ...detail, payrollId: id }) as any));

    await this.repo.update(id, {
      employeeId: dto.employeeId ?? payroll.employeeId,
      month: dto.month ?? payroll.month,
      year: dto.year ?? payroll.year,
      baseSalary: calculation.baseSalary,
      totalAllowances: calculation.totalAllowances,
      totalDeductions: calculation.totalDeductions,
      grossSalary: calculation.grossSalary,
      taxableSalary: calculation.taxableSalary,
      netFiscal: calculation.netFiscal,
      employerContributions: calculation.employerContributions,
      netSalary: calculation.netSalary,
      currency: calculation.currency,
      exchangeRate: calculation.exchangeRate,
      calculationSnapshot: calculation.snapshot as any,
    });
    await this.audit(user?.id, 'payroll:update', id, ipAddress, {
      employeeId: dto.employeeId ?? payroll.employeeId,
      previous: {
        baseSalary: payroll.baseSalary,
        totalAllowances: payroll.totalAllowances,
        totalDeductions: payroll.totalDeductions,
        netSalary: payroll.netSalary,
      },
      next: {
        baseSalary: calculation.baseSalary,
        totalAllowances: calculation.totalAllowances,
        totalDeductions: calculation.totalDeductions,
        netSalary: calculation.netSalary,
      },
    });
    return this.findOne(id);
  }

  async validate(id: number, user?: any, ipAddress?: string) {
    const payroll = await this.findOne(id);
    if (payroll.status === PayrollStatus.ARCHIVED) {
      throw new BadRequestException('Une fiche archivee ne peut pas etre validee.');
    }
    await this.repo.update(id, { status: PayrollStatus.VALIDATED, workflowStep: PayrollStatus.VALIDATED });
    await this.audit(user?.id, 'payroll:validate', id, ipAddress, {
      employeeId: payroll.employeeId,
      previousStatus: payroll.status,
      nextStatus: PayrollStatus.VALIDATED,
    });
    return this.findOne(id);
  }

  async advanceWorkflow(id: number, status: PayrollStatus, user?: any, ipAddress?: string) {
    const payroll = await this.findOne(id);
    const transitions: Record<string, PayrollStatus[]> = {
      [PayrollStatus.DRAFT]: [PayrollStatus.PREPARATION, PayrollStatus.ARCHIVED],
      [PayrollStatus.PREPARATION]: [PayrollStatus.REVIEW, PayrollStatus.DRAFT],
      [PayrollStatus.REVIEW]: [PayrollStatus.VALIDATED, PayrollStatus.PREPARATION],
      [PayrollStatus.VALIDATED]: [PayrollStatus.CLOSED, PayrollStatus.PAID],
      [PayrollStatus.CLOSED]: [PayrollStatus.PAID],
      [PayrollStatus.PAID]: [],
      [PayrollStatus.ARCHIVED]: [PayrollStatus.DRAFT],
    };
    const current = payroll.status || PayrollStatus.DRAFT;
    if (!transitions[current]?.includes(status)) {
      throw new BadRequestException(`Transition de paie invalide: ${current} vers ${status}`);
    }
    await this.repo.update(id, { status, workflowStep: status });
    await this.audit(user?.id, 'payroll:workflow', id, ipAddress, {
      employeeId: payroll.employeeId,
      previousStatus: current,
      nextStatus: status,
    });
    return this.findOne(id);
  }

  async setStatus(id: number, status: PayrollStatus, user?: any, ipAddress?: string) {
    const payroll = await this.findOne(id);
    if (payroll.status === PayrollStatus.PAID && status === PayrollStatus.ARCHIVED) {
      throw new BadRequestException('Une fiche payee ne peut pas etre archivee.');
    }
    await this.repo.update(id, { status });
    await this.audit(user?.id, 'payroll:set_status', id, ipAddress, {
      employeeId: payroll.employeeId,
      previousStatus: payroll.status,
      nextStatus: status,
    });
    return this.findOne(id);
  }

  async toggleStatus(id: number, user?: any, ipAddress?: string) {
    const payroll = await this.findOne(id);
    const nextStatus = payroll.status === PayrollStatus.ARCHIVED ? PayrollStatus.DRAFT : PayrollStatus.ARCHIVED;
    return this.setStatus(id, nextStatus, user, ipAddress);
  }

  async remove(id: number, user?: any, ipAddress?: string) {
    const payroll = await this.findOne(id);
    if ([PayrollStatus.VALIDATED, PayrollStatus.PAID].includes(payroll.status)) {
      throw new BadRequestException('Une fiche de paie validee ou payee ne peut pas etre supprimee.');
    }
    await this.repo.update(id, { status: PayrollStatus.ARCHIVED });
    await this.audit(user?.id, 'payroll:archive', id, ipAddress, {
      employeeId: payroll.employeeId,
      previousStatus: payroll.status,
      nextStatus: PayrollStatus.ARCHIVED,
    });
    return { message: 'Fiche de paie archivee' };
  }

  async getMonthlySummary(month: number, year: number, companyId?: number) {
    const qb = this.repo.createQueryBuilder('p')
      .leftJoin('p.employee', 'e')
      .where('p.month = :month AND p.year = :year', { month, year })
      .andWhere('p.status != :archived', { archived: PayrollStatus.ARCHIVED });

    if (companyId) qb.andWhere('e.companyId = :companyId', { companyId });

    const payrolls = await qb.getMany();
    const totalMasse = payrolls.reduce((sum, payroll) => sum + Number(payroll.netSalary), 0);
    const totalBrut = payrolls.reduce((sum, payroll) => sum + Number(payroll.grossSalary || Number(payroll.baseSalary) + Number(payroll.totalAllowances)), 0);
    const totalDeductions = payrolls.reduce((sum, payroll) => sum + Number(payroll.totalDeductions), 0);
    const employerContributions = payrolls.reduce((sum, payroll) => sum + Number(payroll.employerContributions || 0), 0);
    return { month, year, count: payrolls.length, totalMasse, totalBrut, totalDeductions, employerContributions };
  }

  async generatePayslipHtml(id: number) {
    const payroll = await this.findOne(id);
    const gains = (payroll.details || []).filter((detail) => detail.type === DetailType.ALLOWANCE && Number(detail.amount || 0) > 0);
    const deductions = (payroll.details || []).filter((detail) => detail.type === DetailType.DEDUCTION && Number(detail.amount || 0) > 0);
    const employer = (payroll.details || []).filter((detail) => Number(detail.employerAmount || 0) > 0);
    const snapshot = payroll.calculationSnapshot || {};
    const employee = payroll.employee;

    return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Bulletin de paie ${this.escape(employee?.matricule || '')} - ${payroll.month}/${payroll.year}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 20px; }
    h1 { margin: 0; font-size: 22px; }
    h2 { font-size: 14px; margin: 20px 0 8px; color: #374151; text-transform: uppercase; }
    .muted { color: #6b7280; font-size: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; text-align: left; }
    th { background: #f9fafb; }
    .amount { text-align: right; white-space: nowrap; }
    .total { font-weight: 700; background: #f3f4f6; }
    .net { margin-top: 16px; padding: 14px; border-radius: 8px; background: #eef2ff; color: #312e81; font-size: 18px; font-weight: 800; text-align: right; }
    .signature { margin-top: 48px; display: flex; justify-content: space-between; font-size: 12px; color: #374151; }
    @media print { body { margin: 18mm; } button { display: none; } }
  </style>
</head>
<body>
  <button onclick="window.print()">Imprimer / Enregistrer en PDF</button>
  <div class="header">
    <div>
      <h1>Bulletin de paie</h1>
      <div class="muted">Periode: ${payroll.month}/${payroll.year} · Devise: ${this.escape(payroll.currency || 'CDF')}</div>
    </div>
    <div class="muted">SmartHR · RDC Payroll Engine</div>
  </div>
  <div class="grid">
    <div class="box">
      <h2>Employe</h2>
      <div><b>${this.escape(employee?.lastName || '')} ${this.escape(employee?.firstName || '')}</b></div>
      <div>Matricule: ${this.escape(employee?.matricule || '-')}</div>
      <div>Departement: ${this.escape(employee?.department || '-')}</div>
      <div>Fonction: ${this.escape(employee?.position || '-')}</div>
    </div>
    <div class="box">
      <h2>Calcul</h2>
      <div>Statut: ${this.escape(payroll.status || '-')}</div>
      <div>Taux USD/CDF: ${this.money(payroll.exchangeRate)}</div>
      <div>Version moteur: ${this.escape(snapshot.version || 'legacy')}</div>
      <div>Genere le: ${this.escape(snapshot.generatedAt || payroll.createdAt?.toISOString?.() || '')}</div>
    </div>
  </div>
  <h2>Gains</h2>
  ${this.htmlTable(gains, 'amount')}
  <h2>Retenues employe</h2>
  ${this.htmlTable(deductions, 'amount')}
  <h2>Charges employeur</h2>
  ${this.htmlTable(employer, 'employerAmount')}
  <table>
    <tr><td class="total">Salaire de base</td><td class="amount total">${this.money(payroll.baseSalary)} CDF</td></tr>
    <tr><td class="total">Salaire brut</td><td class="amount total">${this.money(payroll.grossSalary || Number(payroll.baseSalary) + Number(payroll.totalAllowances))} CDF</td></tr>
    <tr><td class="total">Salaire imposable</td><td class="amount total">${this.money(payroll.taxableSalary)} CDF</td></tr>
    <tr><td class="total">Net fiscal</td><td class="amount total">${this.money(payroll.netFiscal)} CDF</td></tr>
  </table>
  <div class="net">Net a payer: ${this.money(payroll.netSalary)} CDF</div>
  <div class="signature">
    <div>Signature employe</div>
    <div>Signature employeur</div>
  </div>
</body>
</html>`;
  }

  async generatePayrollJournalCsv(month: number, year: number, companyId?: number) {
    const rows = await this.getPayrollJournalRows(month, year, companyId);
    return rows.map((row) => row.map((value) => this.csvCell(value)).join(';')).join('\r\n');
  }

  async generatePayrollJournalExcel(month: number, year: number, companyId?: number) {
    const rows = await this.getPayrollJournalRows(month, year, companyId);
    return this.spreadsheetXml([
      { name: 'Journal de paie', rows },
    ]);
  }

  async generatePayrollJournalXlsx(month: number, year: number, companyId?: number) {
    return this.excelWorkbookBuffer([
      { name: 'Journal de paie', rows: await this.getPayrollJournalRows(month, year, companyId) },
    ]);
  }

  async generatePayrollBookExcel(month: number, year: number, companyId?: number) {
    const sheets = await this.getPayrollBookSheets(month, year, companyId);
    return this.spreadsheetXml(sheets);
  }

  async generatePayrollBookXlsx(month: number, year: number, companyId?: number) {
    const sheets = await this.getPayrollBookSheets(month, year, companyId);
    return this.excelWorkbookBuffer(sheets);
  }

  private async getPayrollBookSheets(month: number, year: number, companyId?: number) {
    const payrolls = await this.findAll(month, year, 1, 10000, companyId);
    const departments = new Map<string, any>();

    for (const payroll of payrolls) {
      const department = payroll.employee?.department || 'Non renseigne';
      const current = departments.get(department) || {
        department,
        count: 0,
        baseSalary: 0,
        grossSalary: 0,
        taxableSalary: 0,
        totalDeductions: 0,
        employerContributions: 0,
        netFiscal: 0,
        netSalary: 0,
      };
      current.count += 1;
      current.baseSalary += Number(payroll.baseSalary || 0);
      current.grossSalary += Number(payroll.grossSalary || Number(payroll.baseSalary) + Number(payroll.totalAllowances));
      current.taxableSalary += Number(payroll.taxableSalary || 0);
      current.totalDeductions += Number(payroll.totalDeductions || 0);
      current.employerContributions += Number(payroll.employerContributions || 0);
      current.netFiscal += Number(payroll.netFiscal || 0);
      current.netSalary += Number(payroll.netSalary || 0);
      departments.set(department, current);
    }

    const summaryRows = [
      ['Departement', 'Employes', 'Base', 'Brut', 'Imposable', 'Deductions', 'Charges employeur', 'Net fiscal', 'Net a payer'],
      ...Array.from(departments.values()).map((item) => [
        item.department,
        item.count,
        item.baseSalary,
        item.grossSalary,
        item.taxableSalary,
        item.totalDeductions,
        item.employerContributions,
        item.netFiscal,
        item.netSalary,
      ]),
      [
        'TOTAL',
        payrolls.length,
        payrolls.reduce((sum, p) => sum + Number(p.baseSalary || 0), 0),
        payrolls.reduce((sum, p) => sum + Number(p.grossSalary || Number(p.baseSalary) + Number(p.totalAllowances)), 0),
        payrolls.reduce((sum, p) => sum + Number(p.taxableSalary || 0), 0),
        payrolls.reduce((sum, p) => sum + Number(p.totalDeductions || 0), 0),
        payrolls.reduce((sum, p) => sum + Number(p.employerContributions || 0), 0),
        payrolls.reduce((sum, p) => sum + Number(p.netFiscal || 0), 0),
        payrolls.reduce((sum, p) => sum + Number(p.netSalary || 0), 0),
      ],
    ];

    return [
      { name: 'Livre de paie', rows: summaryRows },
      { name: 'Journal detaille', rows: await this.getPayrollJournalRows(month, year, companyId) },
    ];
  }

  async generatePayslipExcel(id: number) {
    const payroll = await this.findOne(id);
    const gains = (payroll.details || []).filter((detail) => detail.type === DetailType.ALLOWANCE && Number(detail.amount || 0) > 0);
    const deductions = (payroll.details || []).filter((detail) => detail.type === DetailType.DEDUCTION && Number(detail.amount || 0) > 0);
    const employer = (payroll.details || []).filter((detail) => Number(detail.employerAmount || 0) > 0);
    const employee = payroll.employee;
    const snapshot = payroll.calculationSnapshot || {};

    const rows = [
      ['Bulletin de paie', `${payroll.month}/${payroll.year}`],
      ['Matricule', employee?.matricule || ''],
      ['Employe', `${employee?.lastName || ''} ${employee?.firstName || ''}`.trim()],
      ['Departement', employee?.department || ''],
      ['Fonction', employee?.position || ''],
      ['Statut', payroll.status || ''],
      ['Devise', payroll.currency || 'CDF'],
      ['Taux USD/CDF', Number(payroll.exchangeRate || 1)],
      ['Version moteur', snapshot.version || 'legacy'],
      [],
      ['Gains'],
      ['Code', 'Libelle', 'Taux', 'Montant CDF'],
      ...gains.map((detail) => [detail.code || '', detail.label || '', Number(detail.rate || 0), Number(detail.amount || 0)]),
      [],
      ['Retenues employe'],
      ['Code', 'Libelle', 'Taux', 'Montant CDF'],
      ...deductions.map((detail) => [detail.code || '', detail.label || '', Number(detail.rate || 0), Number(detail.amount || 0)]),
      [],
      ['Charges employeur'],
      ['Code', 'Libelle', 'Taux', 'Montant CDF'],
      ...employer.map((detail) => [detail.code || '', detail.label || '', Number(detail.rate || 0), Number(detail.employerAmount || 0)]),
      [],
      ['Totaux'],
      ['Salaire de base', Number(payroll.baseSalary || 0)],
      ['Salaire brut', Number(payroll.grossSalary || Number(payroll.baseSalary) + Number(payroll.totalAllowances))],
      ['Salaire imposable', Number(payroll.taxableSalary || 0)],
      ['Retenues', Number(payroll.totalDeductions || 0)],
      ['Charges employeur', Number(payroll.employerContributions || 0)],
      ['Net fiscal', Number(payroll.netFiscal || 0)],
      ['Net a payer', Number(payroll.netSalary || 0)],
    ];

    return this.excelWorkbookBuffer([{ name: 'Bulletin', rows }]);
  }

  async archivePayslip(id: number, user?: any, ipAddress?: string) {
    const payroll = await this.findOne(id);
    await this.ensurePayrollDocumentsSchema();
    const html = await this.generatePayslipHtml(id);
    const buffer = Buffer.from(html, 'utf8');
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const employeeDir = path.join(this.payrollDocumentRoot, String(payroll.employeeId));
    fs.mkdirSync(employeeDir, { recursive: true });

    const fileName = `bulletin-paie-${payroll.month}-${payroll.year}-${Date.now()}.html`;
    const absolutePath = path.join(employeeDir, fileName);
    fs.writeFileSync(absolutePath, buffer);
    const relativePath = path.join(String(payroll.employeeId), fileName);

    const [document] = await this.dataSource.query(`
      INSERT INTO payroll_documents (
        payroll_id, employee_id, company_id, document_type, file_name, file_path,
        file_size, mime_type, checksum, signature_status, signed_by, signed_at
      ) VALUES ($1,$2,$3,'payslip',$4,$5,$6,'text/html; charset=utf-8',$7,'signed',$8,NOW())
      RETURNING *
    `, [
      payroll.id,
      payroll.employeeId,
      payroll.employee?.companyId || null,
      fileName,
      relativePath,
      buffer.length,
      checksum,
      user?.id || null,
    ]);

    await this.audit(user?.id || null, 'payroll_document:archive_signed', document.id, ipAddress, {
      payrollId: payroll.id,
      employeeId: payroll.employeeId,
      month: payroll.month,
      year: payroll.year,
      checksum,
    }, 'payroll_documents');

    return this.camelPayrollDocument(document);
  }

  async listPayrollDocuments(id: number) {
    await this.findOne(id);
    await this.ensurePayrollDocumentsSchema();
    const rows = await this.dataSource.query(`
      SELECT *
      FROM payroll_documents
      WHERE payroll_id = $1
      ORDER BY created_at DESC
    `, [id]);
    return rows.map((row) => this.camelPayrollDocument(row));
  }

  async downloadPayrollDocument(payrollId: number, documentId: number, user?: any, ipAddress?: string) {
    await this.findOne(payrollId);
    await this.ensurePayrollDocumentsSchema();
    const [document] = await this.dataSource.query(`
      SELECT *
      FROM payroll_documents
      WHERE id = $1 AND payroll_id = $2
    `, [documentId, payrollId]);
    if (!document) throw new NotFoundException('Document de paie introuvable');

    const absolutePath = this.resolvePayrollDocumentPath(document.file_path);
    if (!fs.existsSync(absolutePath)) throw new NotFoundException('Fichier archive introuvable sur le stockage');

    await this.audit(user?.id || null, 'payroll_document:download', document.id, ipAddress, {
      payrollId,
      documentId,
      checksum: document.checksum,
    }, 'payroll_documents');

    return { document: this.camelPayrollDocument(document), absolutePath };
  }

  async getAuditTrail(month: number, year: number, companyId?: number) {
    const payrolls = await this.findAll(month, year, 1, 10000, companyId);
    const payrollIds = payrolls.map((payroll) => payroll.id);

    const params: any[] = [month, year];
    let payrollIdCondition = '';
    if (payrollIds.length) {
      params.push(payrollIds);
      payrollIdCondition = `OR (entity = 'payrolls' AND entity_id = ANY($${params.length}::int[]))`;
    }

    const rows = await this.dataSource.query(`
      SELECT id, user_id, action, entity, entity_id, details, ip_address, created_at
      FROM audit_logs
      WHERE (
        (action LIKE 'payroll%' OR entity IN ('payrolls', 'payroll_generation_jobs', 'payroll_periods', 'payroll_variable_inputs', 'payroll_time_inputs'))
        AND (
          (details->>'month' = $1::text AND details->>'year' = $2::text)
          OR (details::text LIKE $${params.length + 1} AND details::text LIKE $${params.length + 2})
          ${payrollIdCondition}
        )
      )
      ORDER BY created_at DESC
      LIMIT 100
    `, [...params, `%"month":${month}%`, `%"year":${year}%`]);

    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      details: row.details,
      ipAddress: row.ip_address,
      createdAt: row.created_at,
    }));
  }

  preview(dto: PayrollPreviewDto) {
    return this.engine.compute(dto);
  }

  getConfiguration(companyId?: number) {
    return this.engine.getConfiguration(companyId);
  }

  async createRubric(companyId: number | null, dto: CreatePayrollRubricDto, userId?: number, ipAddress?: string) {
    const rubric = await this.engine.createRubric(companyId, dto, userId);
    await this.audit(userId || null, 'payroll_rubric:upsert', rubric.id, ipAddress, {
      companyId,
      code: rubric.code,
      label: rubric.label,
    }, 'payroll_rubrics');
    return rubric;
  }

  async createLegalRate(companyId: number | null, dto: CreateLegalRateDto, userId?: number, ipAddress?: string) {
    const rate = await this.engine.createLegalRate(companyId, dto, userId);
    await this.audit(userId || null, 'payroll_legal_rate:create', rate.id, ipAddress, {
      companyId,
      contributionCode: rate.contribution_code,
      version: rate.version,
      effectiveFrom: rate.effective_from,
    }, 'payroll_legal_rates');
    return rate;
  }

  async createIprBracket(companyId: number | null, dto: CreateIprBracketDto, userId?: number, ipAddress?: string) {
    const bracket = await this.engine.createIprBracket(companyId, dto, userId);
    await this.audit(userId || null, 'payroll_ipr_bracket:create', bracket.id, ipAddress, {
      companyId,
      version: bracket.version,
      minAmount: bracket.min_amount,
      maxAmount: bracket.max_amount,
      rate: bracket.rate,
      effectiveFrom: bracket.effective_from,
    }, 'payroll_ipr_brackets');
    return bracket;
  }

  async createVariable(companyId: number | null, dto: CreatePayrollVariableDto, userId?: number, ipAddress?: string) {
    await this.assertPeriodOpen(companyId, dto.month, dto.year);
    const variable = await this.engine.createVariable(companyId, dto, userId);
    await this.audit(userId || null, 'payroll_variable:create', variable.id, ipAddress, {
      companyId,
      employeeId: variable.employee_id,
      month: variable.month,
      year: variable.year,
      code: variable.code,
      type: variable.type,
      amount: variable.amount,
    }, 'payroll_variable_inputs');
    return variable;
  }

  async importVariablesCsv(companyId: number | null, month: number, year: number, buffer: Buffer, userId?: number, ipAddress?: string) {
    await this.assertPeriodOpen(companyId, month, year);
    const rows = this.parseCsv(buffer.toString('utf8'));
    const result = { total: rows.length, success: 0, failed: 0, errors: [] as any[] };

    for (const [index, row] of rows.entries()) {
      try {
        const employeeId = await this.resolveEmployeeId(companyId, row);
        await this.createVariable(companyId, {
          employeeId,
          month,
          year,
          code: row.code || 'VARIABLE',
          label: row.label || row.libelle || 'Element variable',
          type: this.normalizeVariableType(row.type),
          category: row.category || row.categorie || undefined,
          amount: this.number(row.amount ?? row.montant),
          currency: (row.currency || row.devise || 'CDF').toUpperCase() as 'CDF' | 'USD',
          taxable: this.boolean(row.taxable ?? row.imposable, true),
        }, userId, ipAddress);
        result.success += 1;
      } catch (error) {
        result.failed += 1;
        result.errors.push({ line: index + 2, message: error.message || 'Ligne invalide' });
      }
    }

    await this.audit(userId || null, 'payroll_variables:import_csv', 0, ipAddress, {
      companyId,
      month,
      year,
      total: result.total,
      success: result.success,
      failed: result.failed,
    }, 'payroll_variable_inputs');
    return result;
  }

  listVariables(companyId: number | null, month?: number, year?: number, employeeId?: number) {
    return this.engine.listVariables(companyId, month, year, employeeId);
  }

  async createTimeInput(companyId: number | null, dto: CreatePayrollTimeInputDto, userId?: number, ipAddress?: string) {
    await this.assertPeriodOpen(companyId, dto.month, dto.year);
    const input = await this.engine.createTimeInput(companyId, dto, userId);
    await this.audit(userId || null, 'payroll_time_input:create', input.id, ipAddress, {
      companyId,
      employeeId: input.employee_id,
      month: input.month,
      year: input.year,
      overtimeHours: input.overtime_hours,
      unpaidAbsenceDays: input.unpaid_absence_days,
      lateMinutes: input.late_minutes,
    }, 'payroll_time_inputs');
    return input;
  }

  async importTimeInputsCsv(companyId: number | null, month: number, year: number, buffer: Buffer, userId?: number, ipAddress?: string) {
    await this.assertPeriodOpen(companyId, month, year);
    const rows = this.parseCsv(buffer.toString('utf8'));
    return this.importTimeInputRows(companyId, month, year, rows, 'csv', userId, ipAddress);
  }

  async importTimeInputsExcel(companyId: number | null, month: number, year: number, buffer: Buffer, userId?: number, ipAddress?: string) {
    await this.assertPeriodOpen(companyId, month, year);
    const rows = await this.parseExcelRows(buffer);
    return this.importTimeInputRows(companyId, month, year, rows, 'excel', userId, ipAddress);
  }

  private async importTimeInputRows(
    companyId: number | null,
    month: number,
    year: number,
    rows: Record<string, any>[],
    source: 'csv' | 'excel',
    userId?: number,
    ipAddress?: string,
  ) {
    const result = { total: rows.length, success: 0, failed: 0, errors: [] as any[] };

    for (const [index, row] of rows.entries()) {
      try {
        const employeeId = await this.resolveEmployeeId(companyId, row);
        const computed = this.computeTimeClockValues(row);
        await this.createTimeInput(companyId, {
          employeeId,
          month,
          year,
          overtimeHours: this.number(this.rowValue(row, ['overtime_hours', 'overtimehours', 'heures_sup', 'heures_supplementaires']) ?? computed.overtimeHours),
          nightHours: this.number(this.rowValue(row, ['night_hours', 'nighthours', 'heures_nuit', 'nuit'])),
          sundayHours: this.number(this.rowValue(row, ['sunday_hours', 'sundayhours', 'heures_dimanche', 'dimanche'])),
          holidayHours: this.number(this.rowValue(row, ['holiday_hours', 'holidayhours', 'heures_ferie', 'jours_feries_travailles'])),
          unpaidAbsenceDays: this.number(this.rowValue(row, ['unpaid_absence_days', 'unpaidabsencedays', 'absences_non_payees', 'absence_sans_solde'])),
          lateMinutes: this.number(this.rowValue(row, ['late_minutes', 'lateminutes', 'retards_minutes', 'minutes_retard']) ?? computed.lateMinutes),
          notes: row.notes || undefined,
        }, userId, ipAddress);
        result.success += 1;
      } catch (error) {
        result.failed += 1;
        result.errors.push({ line: index + 2, message: error.message || 'Ligne invalide' });
      }
    }

    await this.audit(userId || null, 'payroll_time_inputs:import_csv', 0, ipAddress, {
      companyId,
      month,
      year,
      total: result.total,
      success: result.success,
      failed: result.failed,
      source,
    }, 'payroll_time_inputs');
    return result;
  }

  listTimeInputs(companyId: number | null, month?: number, year?: number, employeeId?: number) {
    return this.engine.listTimeInputs(companyId, month, year, employeeId);
  }

  async getPeriod(dto: PayrollPeriodDto) {
    await this.ensurePeriodSchema();
    const [period] = await this.dataSource.query(`
      SELECT * FROM payroll_periods
      WHERE company_id = $1 AND month = $2 AND year = $3
      LIMIT 1
    `, [dto.companyId || null, dto.month, dto.year]);
    return period ? this.camelPeriod(period) : {
      companyId: dto.companyId || null,
      month: dto.month,
      year: dto.year,
      status: 'open',
      closedBy: null,
      closedAt: null,
      reason: null,
    };
  }

  async closePeriod(dto: PayrollPeriodDto, user?: any, ipAddress?: string) {
    if (!dto.companyId) throw new BadRequestException('Entreprise requise pour cloturer une periode');
    await this.ensurePeriodSchema();
    const [period] = await this.dataSource.query(`
      INSERT INTO payroll_periods (company_id, month, year, status, closed_by, closed_at, reason)
      VALUES ($1,$2,$3,'closed',$4,NOW(),$5)
      ON CONFLICT (company_id, month, year) DO UPDATE SET
        status = 'closed',
        closed_by = EXCLUDED.closed_by,
        closed_at = NOW(),
        reason = EXCLUDED.reason,
        updated_at = NOW()
      RETURNING *
    `, [dto.companyId, dto.month, dto.year, user?.id || null, dto.reason || null]);
    await this.audit(user?.id, 'payroll_period:close', period.id, ipAddress, {
      companyId: dto.companyId,
      month: dto.month,
      year: dto.year,
      reason: dto.reason,
    }, 'payroll_periods');
    return this.camelPeriod(period);
  }

  async reopenPeriod(dto: PayrollPeriodDto, user?: any, ipAddress?: string) {
    if (!dto.companyId) throw new BadRequestException('Entreprise requise pour rouvrir une periode');
    await this.ensurePeriodSchema();
    const [period] = await this.dataSource.query(`
      INSERT INTO payroll_periods (company_id, month, year, status, reason)
      VALUES ($1,$2,$3,'open',$4)
      ON CONFLICT (company_id, month, year) DO UPDATE SET
        status = 'open',
        reason = EXCLUDED.reason,
        updated_at = NOW()
      RETURNING *
    `, [dto.companyId, dto.month, dto.year, dto.reason || null]);
    await this.audit(user?.id, 'payroll_period:reopen', period.id, ipAddress, {
      companyId: dto.companyId,
      month: dto.month,
      year: dto.year,
      reason: dto.reason,
    }, 'payroll_periods');
    return this.camelPeriod(period);
  }

  async startBatchGeneration(dto: GeneratePayrollBatchDto, user?: any, ipAddress?: string) {
    if (!dto.companyId && !dto.employeeIds?.length) {
      throw new BadRequestException('Entreprise ou liste employes requise pour une generation collective');
    }
    if (dto.companyId) await this.assertPeriodOpen(dto.companyId, dto.month, dto.year);

    await this.ensureBatchSchema();
    const employees = await this.resolveBatchEmployees(dto);
    if (!employees.length) throw new BadRequestException('Aucun employe eligible trouve pour cette generation');

    const [job] = await this.dataSource.query(`
      INSERT INTO payroll_generation_jobs (
        company_id, month, year, status, total_count, processed_count, success_count, failed_count, requested_by, errors
      ) VALUES ($1,$2,$3,'queued',$4,0,0,0,$5,'[]'::jsonb)
      RETURNING *
    `, [dto.companyId || null, dto.month, dto.year, employees.length, user?.id || null]);

    await this.audit(user?.id, 'payroll:batch_queued', job.id, ipAddress, {
      companyId: dto.companyId,
      month: dto.month,
      year: dto.year,
      total: employees.length,
    }, 'payroll_generation_jobs');

    await this.batchQueue.enqueue({
      jobId: job.id,
      employeeIds: employees.map((e) => e.id),
      dto,
      user,
      ipAddress,
    });
    return this.getBatchJob(job.id);
  }

  async getBatchJob(id: number) {
    await this.ensureBatchSchema();
    const [job] = await this.dataSource.query('SELECT * FROM payroll_generation_jobs WHERE id = $1', [id]);
    if (!job) throw new NotFoundException('Job de generation introuvable');
    return this.camelJob(job);
  }

  async cancelBatchJob(id: number, user?: any, ipAddress?: string) {
    const job = await this.getBatchJob(id);
    if (!['queued', 'running'].includes(job.status)) {
      throw new BadRequestException('Seul un traitement en attente ou en cours peut etre annule');
    }
    await this.dataSource.query(`
      UPDATE payroll_generation_jobs
      SET status = 'cancelled', finished_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [id]);
    await this.audit(user?.id, 'payroll:batch_cancelled', id, ipAddress, {
      companyId: job.companyId,
      month: job.month,
      year: job.year,
    }, 'payroll_generation_jobs');
    return this.getBatchJob(id);
  }

  private async processBatchJob(jobId: number, employeeIds: number[], dto: GeneratePayrollBatchDto, user?: any, ipAddress?: string) {
    await this.dataSource.query(`
      UPDATE payroll_generation_jobs SET status = 'running', started_at = NOW(), updated_at = NOW() WHERE id = $1
    `, [jobId]);

    for (const employeeId of employeeIds) {
      const job = await this.getBatchJob(jobId);
      if (job.status === 'cancelled') return;

      try {
        await this.generate({ employeeId, month: dto.month, year: dto.year }, user, ipAddress);
        await this.dataSource.query(`
          UPDATE payroll_generation_jobs
          SET processed_count = processed_count + 1,
              success_count = success_count + 1,
              updated_at = NOW()
          WHERE id = $1
        `, [jobId]);
      } catch (error) {
        await this.dataSource.query(`
          UPDATE payroll_generation_jobs
          SET processed_count = processed_count + 1,
              failed_count = failed_count + 1,
              errors = errors || $2::jsonb,
              updated_at = NOW()
          WHERE id = $1
        `, [jobId, JSON.stringify([{ employeeId, message: error?.message || 'Erreur inconnue' }])]);
      }
    }

    await this.dataSource.query(`
      UPDATE payroll_generation_jobs
      SET status = CASE WHEN failed_count > 0 THEN 'completed_with_errors' ELSE 'completed' END,
          finished_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `, [jobId]);

    const finalJob = await this.getBatchJob(jobId);
    await this.audit(user?.id, 'payroll:batch_completed', jobId, ipAddress, {
      companyId: finalJob.companyId,
      month: finalJob.month,
      year: finalJob.year,
      total: finalJob.totalCount,
      success: finalJob.successCount,
      failed: finalJob.failedCount,
      status: finalJob.status,
    }, 'payroll_generation_jobs');
  }

  private async resolveBatchEmployees(dto: GeneratePayrollBatchDto) {
    const qb = this.empRepo.createQueryBuilder('e')
      .where('e.status = :status', { status: 'active' })
      .orderBy('e.lastName', 'ASC');
    if (dto.companyId) qb.andWhere('e.companyId = :companyId', { companyId: dto.companyId });
    if (dto.employeeIds?.length) qb.andWhere('e.id IN (:...employeeIds)', { employeeIds: dto.employeeIds });
    return qb.getMany();
  }

  private async ensureBatchSchema() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS payroll_generation_jobs (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE SET NULL,
        month INT NOT NULL,
        year INT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'queued',
        total_count INT DEFAULT 0,
        processed_count INT DEFAULT 0,
        success_count INT DEFAULT 0,
        failed_count INT DEFAULT 0,
        requested_by INT REFERENCES users(id),
        errors JSONB DEFAULT '[]'::jsonb,
        started_at TIMESTAMP,
        finished_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  }

  private async ensurePeriodSchema() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS payroll_periods (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        month INT NOT NULL,
        year INT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        closed_by INT REFERENCES users(id),
        closed_at TIMESTAMP,
        reason TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, month, year)
      )
    `);
  }

  private async ensurePayrollDocumentsSchema() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS payroll_documents (
        id SERIAL PRIMARY KEY,
        payroll_id INT REFERENCES payrolls(id) ON DELETE CASCADE,
        employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
        company_id INT REFERENCES companies(id) ON DELETE SET NULL,
        document_type VARCHAR(50) NOT NULL DEFAULT 'payslip',
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size BIGINT DEFAULT 0,
        mime_type VARCHAR(150),
        checksum VARCHAR(128) NOT NULL,
        signature_status VARCHAR(30) NOT NULL DEFAULT 'signed',
        signed_by INT REFERENCES users(id) ON DELETE SET NULL,
        signed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_payroll_documents_payroll_id ON payroll_documents(payroll_id)`);
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_payroll_documents_employee_id ON payroll_documents(employee_id)`);
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_payroll_documents_checksum ON payroll_documents(checksum)`);
  }

  private async assertPeriodOpen(companyId: number | null, month: number, year: number) {
    if (!companyId) return;
    const period = await this.getPeriod({ companyId, month, year });
    if (period.status === 'closed') {
      throw new BadRequestException(`La periode de paie ${month}/${year} est cloturee pour cette entreprise.`);
    }
  }

  private async resolveEmployeeId(companyId: number | null, row: Record<string, any>) {
    const rawId = row.employee_id ?? row.employeeId ?? row.employe_id;
    if (rawId) {
      const employee = await this.empRepo.findOne({ where: { id: Number(rawId) } });
      if (!employee || (companyId && Number(employee.companyId) !== Number(companyId))) {
        throw new BadRequestException(`Employe introuvable: ${rawId}`);
      }
      return employee.id;
    }

    const matricule = this.rowValue(row, ['matricule', 'employee_matricule', 'employee_code', 'code_employe', 'badge']);
    if (!matricule) throw new BadRequestException('employee_id ou matricule requis');
    const employee = await this.empRepo.findOne({ where: { matricule: String(matricule).trim() } });
    if (!employee || (companyId && Number(employee.companyId) !== Number(companyId))) {
      throw new BadRequestException(`Matricule introuvable: ${matricule}`);
    }
    return employee.id;
  }

  private parseCsv(content: string) {
    const clean = content.replace(/^\uFEFF/, '').trim();
    if (!clean) return [];
    const lines = clean.split(/\r?\n/).filter((line) => line.trim());
    const delimiter = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
    const headers = this.splitCsvLine(lines[0], delimiter).map((header) => this.normalizeHeader(header));
    return lines.slice(1).map((line) => {
      const cells = this.splitCsvLine(line, delimiter);
      return headers.reduce((row, header, index) => {
        row[header] = cells[index]?.trim() ?? '';
        return row;
      }, {} as Record<string, string>);
    });
  }

  private async parseExcelRows(buffer: Buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];

    const headers: string[] = [];
    worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      headers[colNumber] = this.normalizeHeader(this.excelCellText(cell.value));
    });

    const rows: Record<string, any>[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const item: Record<string, any> = {};
      let hasValue = false;
      headers.forEach((header, colNumber) => {
        if (!header) return;
        const value = this.excelCellText(row.getCell(colNumber).value);
        if (value !== '') hasValue = true;
        item[header] = value;
      });
      if (hasValue) rows.push(item);
    });
    return rows;
  }

  private excelCellText(value: any) {
    if (value === undefined || value === null) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
      if ('text' in value) return String(value.text ?? '');
      if ('result' in value) return this.excelCellText(value.result);
      if ('richText' in value) return value.richText.map((part: any) => part.text || '').join('');
    }
    return String(value).trim();
  }

  private splitCsvLine(line: string, delimiter: string) {
    const cells: string[] = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"' && quoted && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        cells.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells;
  }

  private normalizeHeader(header: string) {
    return header.trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }

  private normalizeVariableType(type: string) {
    const value = String(type || 'allowance').toLowerCase();
    return ['deduction', 'retenue', 'retention'].includes(value) ? 'deduction' : 'allowance';
  }

  private rowValue(row: Record<string, any>, keys: string[]) {
    for (const key of keys) {
      const value = row[key] ?? row[this.normalizeHeader(key)];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
  }

  private computeTimeClockValues(row: Record<string, any>) {
    const workedHours = this.optionalNumber(this.rowValue(row, ['worked_hours', 'heures_travaillees', 'presence_hours']));
    const expectedHours = this.optionalNumber(this.rowValue(row, ['expected_hours', 'heures_prevues', 'heures_normales']));
    const overtimeHours = workedHours !== undefined && expectedHours !== undefined
      ? Math.max(0, workedHours - expectedHours)
      : 0;

    const actualStart = this.timeToMinutes(this.rowValue(row, ['clock_in', 'heure_arrivee', 'arrival_time']));
    const expectedStart = this.timeToMinutes(this.rowValue(row, ['scheduled_in', 'heure_prevue', 'scheduled_start']));
    const lateMinutes = actualStart !== undefined && expectedStart !== undefined
      ? Math.max(0, actualStart - expectedStart)
      : 0;

    return { overtimeHours, lateMinutes };
  }

  private optionalNumber(value: any) {
    if (value === undefined || value === null || value === '') return undefined;
    return this.number(value);
  }

  private timeToMinutes(value: any) {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 24 * 60);
    const text = String(value).trim();
    const match = text.match(/(\d{1,2})[:hH](\d{2})/);
    if (!match) return undefined;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  private number(value: any) {
    if (value === undefined || value === null || value === '') return 0;
    const normalized = String(value).replace(/\s/g, '').replace(',', '.');
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) throw new BadRequestException(`Montant invalide: ${value}`);
    return parsed;
  }

  private boolean(value: any, defaultValue = false) {
    if (value === undefined || value === null || value === '') return defaultValue;
    return ['true', '1', 'oui', 'yes', 'y'].includes(String(value).trim().toLowerCase());
  }

  private camelJob(job: any) {
    return {
      id: job.id,
      companyId: job.company_id,
      month: job.month,
      year: job.year,
      status: job.status,
      totalCount: job.total_count,
      processedCount: job.processed_count,
      successCount: job.success_count,
      failedCount: job.failed_count,
      requestedBy: job.requested_by,
      errors: job.errors || [],
      startedAt: job.started_at,
      finishedAt: job.finished_at,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      progress: job.total_count ? Math.round((Number(job.processed_count) / Number(job.total_count)) * 100) : 0,
    };
  }

  private camelPeriod(period: any) {
    return {
      id: period.id,
      companyId: period.company_id,
      month: period.month,
      year: period.year,
      status: period.status,
      closedBy: period.closed_by,
      closedAt: period.closed_at,
      reason: period.reason,
      createdAt: period.created_at,
      updatedAt: period.updated_at,
    };
  }

  private camelPayrollDocument(document: any) {
    return {
      id: document.id,
      payrollId: document.payroll_id,
      employeeId: document.employee_id,
      companyId: document.company_id,
      documentType: document.document_type,
      fileName: document.file_name,
      fileSize: Number(document.file_size || 0),
      mimeType: document.mime_type,
      checksum: document.checksum,
      signatureStatus: document.signature_status,
      signedBy: document.signed_by,
      signedAt: document.signed_at,
      createdAt: document.created_at,
      updatedAt: document.updated_at,
    };
  }

  private resolvePayrollDocumentPath(relativePath: string) {
    const absolutePath = path.resolve(this.payrollDocumentRoot, relativePath);
    const relative = path.relative(this.payrollDocumentRoot, absolutePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new BadRequestException('Chemin de fichier invalide');
    return absolutePath;
  }

  private audit(userId: number | null, action: string, entityId: number, ipAddress: string, details: any, entity = 'payrolls') {
    return this.auditRepo.save(this.auditRepo.create({
      userId: userId || null,
      action,
      entity,
      entityId,
      ipAddress,
      details,
    }));
  }

  private htmlTable(details: PayrollDetail[], amountKey: 'amount' | 'employerAmount') {
    if (!details.length) return '<div class="muted">Aucun element</div>';
    const rows = details.map((detail) => `
      <tr>
        <td>${this.escape(detail.code || '')}</td>
        <td>${this.escape(detail.label || '')}</td>
        <td class="amount">${detail.rate ? `${this.money(detail.rate)}%` : '-'}</td>
        <td class="amount">${this.money(detail[amountKey] || 0)} CDF</td>
      </tr>`).join('');
    return `<table><thead><tr><th>Code</th><th>Libelle</th><th>Taux</th><th>Montant</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  private escape(value: any) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private money(value: any) {
    return Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private async getPayrollJournalRows(month: number, year: number, companyId?: number) {
    const payrolls = await this.findAll(month, year, 1, 10000, companyId);
    return [
      ['Matricule', 'Employe', 'Departement', 'Fonction', 'Mois', 'Annee', 'Base', 'Brut', 'Imposable', 'Deductions', 'Charges employeur', 'Net fiscal', 'Net a payer', 'Statut'],
      ...payrolls.map((p) => [
        p.employee?.matricule || '',
        `${p.employee?.lastName || ''} ${p.employee?.firstName || ''}`.trim(),
        p.employee?.department || '',
        p.employee?.position || '',
        p.month,
        p.year,
        Number(p.baseSalary || 0),
        Number(p.grossSalary || Number(p.baseSalary) + Number(p.totalAllowances)),
        Number(p.taxableSalary || 0),
        Number(p.totalDeductions || 0),
        Number(p.employerContributions || 0),
        Number(p.netFiscal || 0),
        Number(p.netSalary || 0),
        p.status || '',
      ]),
    ];
  }

  private async excelWorkbookBuffer(sheets: { name: string; rows: any[][] }[]) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SmartHR';
    workbook.created = new Date();

    for (const sheet of sheets) {
      const worksheet = workbook.addWorksheet(sheet.name.slice(0, 31));
      sheet.rows.forEach((row, rowIndex) => {
        const excelRow = worksheet.addRow(row);
        const isHeader = rowIndex === 0 || this.isSectionHeader(row);
        if (isHeader) {
          excelRow.font = { bold: true, color: { argb: 'FF111827' } };
          excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
        }
        excelRow.eachCell((cell) => {
          cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
          if (typeof cell.value === 'number') {
            cell.numFmt = '#,##0.00';
            cell.alignment = { horizontal: 'right' };
          }
        });
      });

      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
      worksheet.columns.forEach((column) => {
        let width = 12;
        column.eachCell({ includeEmpty: true }, (cell) => {
          width = Math.max(width, String(cell.value ?? '').length + 2);
        });
        column.width = Math.min(width, 42);
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as ArrayBuffer);
  }

  private isSectionHeader(row: any[]) {
    return row.length === 1 && Boolean(row[0]);
  }

  private spreadsheetXml(sheets: { name: string; rows: any[][] }[]) {
    const worksheets = sheets.map((sheet) => `
      <Worksheet ss:Name="${this.xml(sheet.name).slice(0, 31)}">
        <Table>
          ${sheet.rows.map((row, index) => this.spreadsheetRow(row, index === 0)).join('')}
        </Table>
      </Worksheet>
    `).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#EEF2FF" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
    <Style ss:ID="Cell"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders></Style>
    <Style ss:ID="Number"><NumberFormat ss:Format="#,##0.00"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders></Style>
  </Styles>
  ${worksheets}
</Workbook>`;
  }

  private spreadsheetRow(row: any[], isHeader = false) {
    return `<Row>${row.map((value) => this.spreadsheetCell(value, isHeader)).join('')}</Row>`;
  }

  private spreadsheetCell(value: any, isHeader = false) {
    const isNumber = typeof value === 'number' && Number.isFinite(value);
    const type = isNumber ? 'Number' : 'String';
    const style = isHeader ? 'Header' : isNumber ? 'Number' : 'Cell';
    return `<Cell ss:StyleID="${style}"><Data ss:Type="${type}">${this.xml(value)}</Data></Cell>`;
  }

  private xml(value: any) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private csvCell(value: any) {
    const text = String(value ?? '').replace(/"/g, '""');
    return `"${text}"`;
  }
}
