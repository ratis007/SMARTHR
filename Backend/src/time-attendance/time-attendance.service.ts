import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { AuditLog } from '../users/audit-log.entity';
import {
  AssignWorkProfileDto,
  CalculateAttendanceDto,
  CreateClockEventDto,
  CreateHolidayDto,
  CreateRotationPatternDto,
  CreateTeamDto,
  CreateWorkProfileDto,
  DetectAttendanceAlertsDto,
  DispatchNotificationsDto,
  ExportAttendanceToPayrollDto,
  GenerateScheduleDto,
  ImportClockEventsDto,
  UpdateAttendanceAlertDto,
  UpdateScheduleEntryDto,
  WorkProfileDayDto,
} from './dto/time-attendance.dto';
import { TimeAttendanceQueuePayload, TimeAttendanceQueueService } from './time-attendance-queue.service';

type Schedule = {
  profileId: number | null;
  profileCode: string;
  profileName: string;
  graceLateMinutes: number;
  overtimeThresholdMinutes: number;
  isWorkingDay: boolean;
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
  expectedMinutes: number;
};

@Injectable()
export class TimeAttendanceService implements OnModuleInit {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private queueService: TimeAttendanceQueueService,
  ) {}

  async onModuleInit() {
    await this.ensureSchema();
    this.queueService.registerProcessor((payload) => this.processQueuedJob(payload));
  }

  async getConfiguration(companyId: number) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const [profiles, days, holidays, teams, rotations, workflows] = await Promise.all([
      this.dataSource.query('SELECT * FROM time_work_profiles WHERE company_id = $1 ORDER BY name ASC', [companyId]),
      this.dataSource.query(`
        SELECT d.*
        FROM time_work_profile_days d
        JOIN time_work_profiles p ON p.id = d.profile_id
        WHERE p.company_id = $1
        ORDER BY d.profile_id, d.weekday
      `, [companyId]),
      this.dataSource.query('SELECT * FROM time_holidays WHERE company_id = $1 ORDER BY holiday_date DESC', [companyId]),
      this.dataSource.query('SELECT * FROM time_shift_teams WHERE company_id = $1 ORDER BY name ASC', [companyId]),
      this.dataSource.query('SELECT * FROM time_rotation_patterns WHERE company_id = $1 ORDER BY name ASC', [companyId]),
      this.dataSource.query('SELECT * FROM time_approval_workflows WHERE company_id = $1 ORDER BY name ASC', [companyId]),
    ]);
    return {
      profiles: profiles.map((row) => ({ ...this.camel(row), days: days.filter((day) => Number(day.profile_id) === Number(row.id)).map(this.camel) })),
      holidays: holidays.map(this.camel),
      teams: teams.map(this.camel),
      rotations: rotations.map(this.camel),
      workflows: workflows.map(this.camel),
    };
  }

  async createWorkProfile(companyId: number, dto: CreateWorkProfileDto, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const [profile] = await this.dataSource.query(`
      INSERT INTO time_work_profiles (
        company_id, code, name, profile_type, weekly_hours, grace_late_minutes,
        overtime_threshold_minutes, flexible_arrival_from, flexible_arrival_to, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (company_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        profile_type = EXCLUDED.profile_type,
        weekly_hours = EXCLUDED.weekly_hours,
        grace_late_minutes = EXCLUDED.grace_late_minutes,
        overtime_threshold_minutes = EXCLUDED.overtime_threshold_minutes,
        flexible_arrival_from = EXCLUDED.flexible_arrival_from,
        flexible_arrival_to = EXCLUDED.flexible_arrival_to,
        updated_at = NOW()
      RETURNING *
    `, [
      companyId,
      dto.code.trim().toUpperCase(),
      dto.name,
      dto.profileType || 'standard',
      dto.weeklyHours || 40,
      dto.graceLateMinutes ?? 5,
      dto.overtimeThresholdMinutes ?? 0,
      dto.flexibleArrivalFrom || null,
      dto.flexibleArrivalTo || null,
      user?.id || null,
    ]);

    if (dto.days?.length) {
      await this.dataSource.query('DELETE FROM time_work_profile_days WHERE profile_id = $1', [profile.id]);
      for (const day of dto.days) await this.upsertProfileDay(profile.id, day);
    } else {
      await this.seedStandardProfileDays(profile.id);
    }

    await this.audit(user?.id, 'time_profile:upsert', 'time_work_profiles', profile.id, ipAddress, { companyId, code: profile.code });
    return this.getWorkProfile(profile.id);
  }

  async createHoliday(companyId: number, dto: CreateHolidayDto, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const [holiday] = await this.dataSource.query(`
      INSERT INTO time_holidays (company_id, holiday_date, name, is_paid, created_by)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (company_id, holiday_date) DO UPDATE SET
        name = EXCLUDED.name,
        is_paid = EXCLUDED.is_paid,
        updated_at = NOW()
      RETURNING *
    `, [companyId, dto.holidayDate, dto.name, dto.isPaid !== false, user?.id || null]);
    await this.audit(user?.id, 'time_holiday:upsert', 'time_holidays', holiday.id, ipAddress, { companyId, date: dto.holidayDate });
    return this.camel(holiday);
  }

  async createTeam(companyId: number, dto: CreateTeamDto, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const [team] = await this.dataSource.query(`
      INSERT INTO time_shift_teams (company_id, code, name, site_id, rotation_pattern, created_by)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (company_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        site_id = EXCLUDED.site_id,
        rotation_pattern = EXCLUDED.rotation_pattern,
        updated_at = NOW()
      RETURNING *
    `, [companyId, dto.code.trim().toUpperCase(), dto.name, dto.siteId || null, dto.rotationPattern || null, user?.id || null]);
    await this.audit(user?.id, 'time_team:upsert', 'time_shift_teams', team.id, ipAddress, { companyId, code: team.code });
    return this.camel(team);
  }

  async createRotationPattern(companyId: number, dto: CreateRotationPatternDto, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    await this.ensureProfile(companyId, dto.dayProfileId);
    if (dto.nightProfileId) await this.ensureProfile(companyId, dto.nightProfileId);
    if (dto.workDays < 1 || dto.restDays < 0) throw new BadRequestException('Cycle de rotation invalide');
    const [rotation] = await this.dataSource.query(`
      INSERT INTO time_rotation_patterns (
        company_id, code, name, rotation_type, work_days, rest_days,
        cycle_start_date, day_profile_id, night_profile_id, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (company_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        rotation_type = EXCLUDED.rotation_type,
        work_days = EXCLUDED.work_days,
        rest_days = EXCLUDED.rest_days,
        cycle_start_date = EXCLUDED.cycle_start_date,
        day_profile_id = EXCLUDED.day_profile_id,
        night_profile_id = EXCLUDED.night_profile_id,
        updated_at = NOW()
      RETURNING *
    `, [
      companyId,
      dto.code.trim().toUpperCase(),
      dto.name,
      dto.rotationType || 'work_rest',
      dto.workDays,
      dto.restDays,
      dto.cycleStartDate,
      dto.dayProfileId,
      dto.nightProfileId || null,
      user?.id || null,
    ]);
    await this.audit(user?.id, 'time_rotation:upsert', 'time_rotation_patterns', rotation.id, ipAddress, { companyId, code: rotation.code });
    return this.camel(rotation);
  }

  async assignWorkProfile(companyId: number, dto: AssignWorkProfileDto, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    await this.ensureProfile(companyId, dto.profileId);
    if (dto.employeeId) await this.ensureEmployee(companyId, dto.employeeId);
    const [assignment] = await this.dataSource.query(`
      INSERT INTO time_employee_work_profile_assignments (
        company_id, profile_id, employee_id, department, position, team_id, effective_from, effective_to, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [
      companyId,
      dto.profileId,
      dto.employeeId || null,
      dto.department || null,
      dto.position || null,
      dto.teamId || null,
      dto.effectiveFrom,
      dto.effectiveTo || null,
      user?.id || null,
    ]);
    await this.audit(user?.id, 'time_assignment:create', 'time_employee_work_profile_assignments', assignment.id, ipAddress, { companyId, profileId: dto.profileId });
    return this.camel(assignment);
  }

  async createClockEvent(companyId: number, dto: CreateClockEventDto, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const employee = await this.ensureEmployee(companyId, dto.employeeId);
    const eventType = String(dto.eventType || '').toLowerCase();
    if (!['entry', 'exit'].includes(eventType)) throw new BadRequestException('Type de pointage invalide');
    const [event] = await this.dataSource.query(`
      INSERT INTO time_clock_events (
        company_id, employee_id, event_type, event_time, method, terminal_id,
        location_label, latitude, longitude, source, created_by, external_reference, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      companyId,
      employee.id,
      eventType,
      dto.eventTime || new Date().toISOString(),
      dto.method || 'manual',
      dto.terminalId || null,
      dto.locationLabel || null,
      dto.latitude ?? null,
      dto.longitude ?? null,
      'manual',
      user?.id || null,
      null,
      JSON.stringify({ channel: 'manual' }),
    ]);
    await this.audit(user?.id, 'time_clock:create', 'time_clock_events', event.id, ipAddress, { companyId, employeeId: employee.id, eventType });
    return this.camel(event);
  }

  async importClockEvents(companyId: number, dto: ImportClockEventsDto, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    if (!dto.events?.length) throw new BadRequestException('Aucun pointage a importer');
    await this.ensureSchema();

    const source = dto.source || 'api_terminal';
    const result = { total: dto.events.length, success: 0, duplicates: 0, failed: 0, errors: [] as any[] };

    for (const [index, item] of dto.events.entries()) {
      try {
        const employee = item.employeeId
          ? await this.ensureEmployee(companyId, item.employeeId)
          : await this.resolveEmployeeByReference(companyId, item.matricule || item.externalEmployeeRef);
        const eventType = String(item.eventType || '').toLowerCase();
        if (!['entry', 'exit'].includes(eventType)) throw new BadRequestException('Type de pointage invalide');
        if (!item.eventTime) throw new BadRequestException('Heure de pointage obligatoire');

        const terminalId = item.terminalId || dto.terminalId || null;
        const externalReference = item.externalReference || this.clockExternalReference(source, terminalId, employee.id, eventType, item.eventTime);
        const [event] = await this.dataSource.query(`
          INSERT INTO time_clock_events (
            company_id, employee_id, event_type, event_time, method, terminal_id,
            location_label, latitude, longitude, source, created_by, external_reference, metadata
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT DO NOTHING
          RETURNING *
        `, [
          companyId,
          employee.id,
          eventType,
          item.eventTime,
          item.method || source,
          terminalId,
          item.locationLabel || null,
          item.latitude ?? null,
          item.longitude ?? null,
          source,
          user?.id || null,
          externalReference,
          JSON.stringify({
            batchReference: dto.batchReference || null,
            externalEmployeeRef: item.externalEmployeeRef || item.matricule || null,
            importedAt: new Date().toISOString(),
          }),
        ]);
        if (event) result.success += 1;
        else result.duplicates += 1;
      } catch (error) {
        result.failed += 1;
        result.errors.push({ line: index + 1, message: error.message || 'Pointage invalide' });
      }
    }

    await this.audit(user?.id, 'time_clock:import_batch', 'time_clock_events', 0, ipAddress, {
      companyId,
      source,
      terminalId: dto.terminalId || null,
      batchReference: dto.batchReference || null,
      ...result,
    });
    return result;
  }

  async calculateAttendance(companyId: number, dto: CalculateAttendanceDto, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const employees = await this.resolveEmployees(companyId, dto.employeeId);
    const dates = this.datesBetween(dto.dateFrom, dto.dateTo);
    const result = { total: employees.length * dates.length, success: 0, failed: 0, errors: [] as any[] };

    for (const date of dates) {
      for (const employee of employees) {
        try {
          await this.calculateEmployeeDay(companyId, employee, date, user);
          result.success += 1;
        } catch (error) {
          result.failed += 1;
          result.errors.push({ employeeId: employee.id, date, message: error.message || 'Calcul impossible' });
        }
      }
    }

    await this.audit(user?.id, 'time_attendance:calculate', 'time_attendance_days', 0, ipAddress, { companyId, ...dto, ...result });
    return result;
  }

  async startCalculateJob(companyId: number, dto: CalculateAttendanceDto, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureProcessingJobSchema();
    const employees = await this.resolveEmployees(companyId, dto.employeeId);
    const dates = this.datesBetween(dto.dateFrom, dto.dateTo);
    if (!employees.length) throw new BadRequestException('Aucun employe eligible trouve pour ce calcul');
    const [job] = await this.dataSource.query(`
      INSERT INTO time_processing_jobs (
        company_id, job_type, status, total_count, processed_count, success_count, failed_count, payload, requested_by, errors
      ) VALUES ($1,'calculate','queued',$2,0,0,0,$3,$4,'[]'::jsonb)
      RETURNING *
    `, [companyId, employees.length * dates.length, JSON.stringify(dto), user?.id || null]);
    await this.audit(user?.id, 'time_job:queued', 'time_processing_jobs', job.id, ipAddress, {
      companyId,
      jobType: 'calculate',
      total: employees.length * dates.length,
      payload: dto,
    });
    await this.queueService.enqueue({ jobId: job.id, action: 'calculate', companyId, dto, user, ipAddress });
    return this.camelJob(job);
  }

  async generateSchedule(companyId: number, dto: GenerateScheduleDto, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const dates = this.datesBetween(dto.dateFrom, dto.dateTo);
    const employees = await this.resolveScheduleEmployees(companyId, dto);
    const rotation = dto.rotationPatternId ? await this.ensureRotation(companyId, dto.rotationPatternId) : null;
    const fixedProfile = dto.profileId ? await this.ensureProfile(companyId, dto.profileId) : null;
    if (!rotation && !fixedProfile) throw new BadRequestException('Rotation ou profil horaire obligatoire');

    const result = { total: employees.length * dates.length, success: 0, skipped: 0, failed: 0, errors: [] as any[] };
    for (const employee of employees) {
      for (const date of dates) {
        try {
          const plan = rotation
            ? this.planFromRotation(rotation, date)
            : { status: 'planned', profileId: fixedProfile.id, shiftLabel: fixedProfile.name, rotationDay: null };
          const profile = plan.profileId ? await this.getProfileDayPlan(plan.profileId, date) : null;
          const [row] = await this.dataSource.query(`
            INSERT INTO time_schedule_entries (
              company_id, employee_id, work_date, profile_id, team_id, rotation_pattern_id,
              shift_label, planned_start, planned_end, status, rotation_day, created_by
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (employee_id, work_date) DO UPDATE SET
              profile_id = CASE WHEN $13 THEN EXCLUDED.profile_id ELSE time_schedule_entries.profile_id END,
              team_id = CASE WHEN $13 THEN EXCLUDED.team_id ELSE time_schedule_entries.team_id END,
              rotation_pattern_id = CASE WHEN $13 THEN EXCLUDED.rotation_pattern_id ELSE time_schedule_entries.rotation_pattern_id END,
              shift_label = CASE WHEN $13 THEN EXCLUDED.shift_label ELSE time_schedule_entries.shift_label END,
              planned_start = CASE WHEN $13 THEN EXCLUDED.planned_start ELSE time_schedule_entries.planned_start END,
              planned_end = CASE WHEN $13 THEN EXCLUDED.planned_end ELSE time_schedule_entries.planned_end END,
              status = CASE WHEN $13 THEN EXCLUDED.status ELSE time_schedule_entries.status END,
              rotation_day = CASE WHEN $13 THEN EXCLUDED.rotation_day ELSE time_schedule_entries.rotation_day END,
              updated_at = NOW()
            RETURNING *
          `, [
            companyId,
            employee.id,
            date,
            plan.profileId,
            dto.teamId || null,
            rotation?.id || null,
            plan.shiftLabel,
            profile?.startTime || null,
            profile?.endTime || null,
            plan.status,
            plan.rotationDay,
            user?.id || null,
            dto.overwrite !== false,
          ]);
          if (row) result.success += 1;
          else result.skipped += 1;
        } catch (error) {
          result.failed += 1;
          result.errors.push({ employeeId: employee.id, date, message: error.message || 'Planning impossible' });
        }
      }
    }

    await this.audit(user?.id, 'time_schedule:generate', 'time_schedule_entries', 0, ipAddress, { companyId, ...dto, ...result });
    return result;
  }

  async listSchedule(companyId: number, dateFrom?: string, dateTo?: string, employeeId?: number, teamId?: number) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const params: any[] = [companyId];
    let sql = `
      SELECT s.*, e.matricule, e.last_name, e.first_name, e.department,
        p.code AS profile_code, p.name AS profile_name,
        t.code AS team_code, t.name AS team_name,
        r.code AS rotation_code, r.name AS rotation_name
      FROM time_schedule_entries s
      JOIN employees e ON e.id = s.employee_id
      LEFT JOIN time_work_profiles p ON p.id = s.profile_id
      LEFT JOIN time_shift_teams t ON t.id = s.team_id
      LEFT JOIN time_rotation_patterns r ON r.id = s.rotation_pattern_id
      WHERE s.company_id = $1
    `;
    if (dateFrom) { params.push(dateFrom); sql += ` AND s.work_date >= $${params.length}`; }
    if (dateTo) { params.push(dateTo); sql += ` AND s.work_date <= $${params.length}`; }
    if (employeeId) { params.push(employeeId); sql += ` AND s.employee_id = $${params.length}`; }
    if (teamId) { params.push(teamId); sql += ` AND s.team_id = $${params.length}`; }
    sql += ' ORDER BY s.work_date ASC, e.last_name ASC LIMIT 5000';
    const rows = await this.dataSource.query(sql, params);
    return rows.map(this.camel);
  }

  async updateScheduleEntry(companyId: number, id: number, dto: UpdateScheduleEntryDto, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const [current] = await this.dataSource.query('SELECT * FROM time_schedule_entries WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (!current) throw new NotFoundException('Ligne de planning introuvable');

    const allowedStatuses = ['planned', 'rest', 'leave', 'training', 'suspended'];
    const status = dto.status || current.status || 'planned';
    if (!allowedStatuses.includes(status)) throw new BadRequestException('Statut planning invalide');

    const employeeId = dto.employeeId || current.employee_id;
    const workDate = dto.workDate || this.dateOnly(new Date(current.work_date));
    await this.ensureEmployee(companyId, employeeId);
    if (dto.profileId) await this.ensureProfile(companyId, dto.profileId);
    if (dto.teamId) await this.ensureTeam(companyId, dto.teamId);

    const profileId = status === 'rest' ? null : (dto.profileId ?? current.profile_id);
    const profileDay = profileId ? await this.getProfileDayPlan(profileId, workDate) : null;
    const plannedStart = status === 'rest' ? null : (dto.plannedStart ?? current.planned_start ?? profileDay?.startTime ?? null);
    const plannedEnd = status === 'rest' ? null : (dto.plannedEnd ?? current.planned_end ?? profileDay?.endTime ?? null);
    const shiftLabel = dto.shiftLabel ?? current.shift_label ?? (status === 'rest' ? 'Repos manuel' : null);

    const [updated] = await this.dataSource.query(`
      UPDATE time_schedule_entries SET
        employee_id = $1,
        work_date = $2,
        profile_id = $3,
        team_id = $4,
        rotation_pattern_id = CASE WHEN $10 THEN NULL ELSE rotation_pattern_id END,
        shift_label = $5,
        planned_start = $6,
        planned_end = $7,
        status = $8,
        metadata = metadata || $9::jsonb,
        updated_at = NOW()
      WHERE id = $11 AND company_id = $12
      RETURNING *
    `, [
      employeeId,
      workDate,
      profileId,
      dto.teamId ?? current.team_id,
      shiftLabel,
      plannedStart,
      plannedEnd,
      status,
      JSON.stringify({
        manualOverride: true,
        previousEmployeeId: current.employee_id,
        previousWorkDate: this.dateOnly(new Date(current.work_date)),
        previousStatus: current.status,
        previousProfileId: current.profile_id,
        updatedBy: user?.id || null,
        updatedAt: new Date().toISOString(),
      }),
      Boolean(dto.profileId || dto.status || dto.plannedStart || dto.plannedEnd || dto.shiftLabel),
      id,
      companyId,
    ]).catch((error) => {
      if (String(error.message || '').includes('duplicate key')) {
        throw new BadRequestException('Une ligne de planning existe deja pour cet employe et cette date');
      }
      throw error;
    });

    if (dto.recalculate) {
      const employee = await this.ensureEmployee(companyId, employeeId);
      await this.calculateEmployeeDay(companyId, employee, workDate, user);
    }

    await this.audit(user?.id, 'time_schedule:update', 'time_schedule_entries', id, ipAddress, {
      companyId,
      previous: this.camel(current),
      next: this.camel(updated),
      recalculate: Boolean(dto.recalculate),
    });
    return this.camel(updated);
  }

  async listAttendanceDays(companyId: number, dateFrom?: string, dateTo?: string, employeeId?: number) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const params: any[] = [companyId];
    let sql = `
      SELECT d.*, e.matricule, e.last_name, e.first_name, e.department, e.position
      FROM time_attendance_days d
      JOIN employees e ON e.id = d.employee_id
      WHERE d.company_id = $1
    `;
    if (dateFrom) { params.push(dateFrom); sql += ` AND d.work_date >= $${params.length}`; }
    if (dateTo) { params.push(dateTo); sql += ` AND d.work_date <= $${params.length}`; }
    if (employeeId) { params.push(employeeId); sql += ` AND d.employee_id = $${params.length}`; }
    sql += ' ORDER BY d.work_date DESC, e.last_name ASC LIMIT 5000';
    const rows = await this.dataSource.query(sql, params);
    return rows.map(this.camel);
  }

  async detectAlerts(companyId: number, dto: DetectAttendanceAlertsDto, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const dates = this.datesBetween(dto.dateFrom, dto.dateTo);
    const enabled = new Set(dto.alertTypes?.length ? dto.alertTypes : ['late', 'absence', 'missed_punch', 'early_departure']);
    const result = { total: 0, created: 0, updated: 0, queued: 0 };

    if (enabled.has('late')) {
      const rows = await this.dataSource.query(`
        SELECT d.id AS attendance_day_id, d.employee_id, d.work_date AS alert_date,
          d.late_minutes, e.matricule, e.last_name, e.first_name, e.email, e.phone
        FROM time_attendance_days d
        JOIN employees e ON e.id = d.employee_id
        WHERE d.company_id = $1 AND d.work_date BETWEEN $2 AND $3 AND d.late_minutes > 0
      `, [companyId, dto.dateFrom, dto.dateTo]);
      for (const row of rows) {
        const saved = await this.upsertAlert(companyId, {
          employeeId: row.employee_id,
          attendanceDayId: row.attendance_day_id,
          alertDate: this.dateOnly(new Date(row.alert_date)),
          alertType: 'late',
          severity: Number(row.late_minutes || 0) >= 30 ? 'high' : 'medium',
          title: 'Retard detecte',
          message: `${row.matricule} - ${row.last_name} ${row.first_name}: ${row.late_minutes} minute(s) de retard.`,
          metadata: { lateMinutes: Number(row.late_minutes || 0), matricule: row.matricule },
          employee: row,
        }, user);
        this.countAlertResult(result, saved);
      }
    }

    if (enabled.has('absence')) {
      const rows = await this.dataSource.query(`
        SELECT d.id AS attendance_day_id, d.employee_id, d.work_date AS alert_date,
          d.unpaid_absence_minutes, e.matricule, e.last_name, e.first_name, e.email, e.phone
        FROM time_attendance_days d
        JOIN employees e ON e.id = d.employee_id
        WHERE d.company_id = $1 AND d.work_date BETWEEN $2 AND $3 AND d.presence_status = 'absent'
      `, [companyId, dto.dateFrom, dto.dateTo]);
      for (const row of rows) {
        const saved = await this.upsertAlert(companyId, {
          employeeId: row.employee_id,
          attendanceDayId: row.attendance_day_id,
          alertDate: this.dateOnly(new Date(row.alert_date)),
          alertType: 'absence',
          severity: 'high',
          title: 'Absence detectee',
          message: `${row.matricule} - ${row.last_name} ${row.first_name}: absence non justifiee detectee.`,
          metadata: { unpaidAbsenceMinutes: Number(row.unpaid_absence_minutes || 0), matricule: row.matricule },
          employee: row,
        }, user);
        this.countAlertResult(result, saved);
      }
    }

    if (enabled.has('early_departure')) {
      const rows = await this.dataSource.query(`
        SELECT d.id AS attendance_day_id, d.employee_id, d.work_date AS alert_date,
          d.early_departure_minutes, e.matricule, e.last_name, e.first_name, e.email, e.phone
        FROM time_attendance_days d
        JOIN employees e ON e.id = d.employee_id
        WHERE d.company_id = $1 AND d.work_date BETWEEN $2 AND $3 AND d.early_departure_minutes > 0
      `, [companyId, dto.dateFrom, dto.dateTo]);
      for (const row of rows) {
        const saved = await this.upsertAlert(companyId, {
          employeeId: row.employee_id,
          attendanceDayId: row.attendance_day_id,
          alertDate: this.dateOnly(new Date(row.alert_date)),
          alertType: 'early_departure',
          severity: Number(row.early_departure_minutes || 0) >= 30 ? 'high' : 'medium',
          title: 'Depart anticipe',
          message: `${row.matricule} - ${row.last_name} ${row.first_name}: depart anticipe de ${row.early_departure_minutes} minute(s).`,
          metadata: { earlyDepartureMinutes: Number(row.early_departure_minutes || 0), matricule: row.matricule },
          employee: row,
        }, user);
        this.countAlertResult(result, saved);
      }
    }

    if (enabled.has('missed_punch')) {
      const rows = await this.dataSource.query(`
        SELECT s.id AS schedule_entry_id, s.employee_id, s.work_date AS alert_date,
          e.matricule, e.last_name, e.first_name, e.email, e.phone,
          COUNT(ce.id) FILTER (WHERE ce.event_type = 'entry')::int AS entries,
          COUNT(ce.id) FILTER (WHERE ce.event_type = 'exit')::int AS exits
        FROM time_schedule_entries s
        JOIN employees e ON e.id = s.employee_id
        LEFT JOIN time_clock_events ce ON ce.company_id = s.company_id
          AND ce.employee_id = s.employee_id
          AND ce.event_time::date = s.work_date
        WHERE s.company_id = $1 AND s.work_date BETWEEN $2 AND $3 AND s.status = 'planned'
        GROUP BY s.id, s.employee_id, s.work_date, e.matricule, e.last_name, e.first_name, e.email, e.phone
        HAVING COUNT(ce.id) FILTER (WHERE ce.event_type = 'entry') = 0
            OR COUNT(ce.id) FILTER (WHERE ce.event_type = 'exit') = 0
      `, [companyId, dto.dateFrom, dto.dateTo]);
      for (const row of rows) {
        const missing = [Number(row.entries || 0) === 0 ? 'entree' : null, Number(row.exits || 0) === 0 ? 'sortie' : null].filter(Boolean).join(' et ');
        const saved = await this.upsertAlert(companyId, {
          employeeId: row.employee_id,
          scheduleEntryId: row.schedule_entry_id,
          alertDate: this.dateOnly(new Date(row.alert_date)),
          alertType: 'missed_punch',
          severity: 'medium',
          title: 'Oubli de pointage',
          message: `${row.matricule} - ${row.last_name} ${row.first_name}: pointage ${missing} manquant.`,
          metadata: { entries: Number(row.entries || 0), exits: Number(row.exits || 0), matricule: row.matricule },
          employee: row,
        }, user);
        this.countAlertResult(result, saved);
      }
    }

    result.total = result.created + result.updated;
    await this.audit(user?.id, 'time_alerts:detect', 'time_attendance_alerts', 0, ipAddress, { companyId, dates: dates.length, ...result });
    return result;
  }

  async startDetectAlertsJob(companyId: number, dto: DetectAttendanceAlertsDto, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureProcessingJobSchema();
    const dates = this.datesBetween(dto.dateFrom, dto.dateTo);
    const [job] = await this.dataSource.query(`
      INSERT INTO time_processing_jobs (
        company_id, job_type, status, total_count, processed_count, success_count, failed_count, payload, requested_by, errors
      ) VALUES ($1,'detect_alerts','queued',$2,0,0,0,$3,$4,'[]'::jsonb)
      RETURNING *
    `, [companyId, dates.length, JSON.stringify(dto), user?.id || null]);
    await this.audit(user?.id, 'time_job:queued', 'time_processing_jobs', job.id, ipAddress, {
      companyId,
      jobType: 'detect_alerts',
      total: dates.length,
      payload: dto,
    });
    await this.queueService.enqueue({ jobId: job.id, action: 'detect_alerts', companyId, dto, user, ipAddress });
    return this.camelJob(job);
  }

  async listAlerts(companyId: number, dateFrom?: string, dateTo?: string, status?: string, alertType?: string, employeeId?: number) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const params: any[] = [companyId];
    let sql = `
      SELECT a.*, e.matricule, e.last_name, e.first_name, e.department, e.position
      FROM time_attendance_alerts a
      JOIN employees e ON e.id = a.employee_id
      WHERE a.company_id = $1
    `;
    if (dateFrom) { params.push(dateFrom); sql += ` AND a.alert_date >= $${params.length}`; }
    if (dateTo) { params.push(dateTo); sql += ` AND a.alert_date <= $${params.length}`; }
    if (status) { params.push(status); sql += ` AND a.status = $${params.length}`; }
    if (alertType) { params.push(alertType); sql += ` AND a.alert_type = $${params.length}`; }
    if (employeeId) { params.push(employeeId); sql += ` AND a.employee_id = $${params.length}`; }
    sql += ' ORDER BY a.alert_date DESC, a.severity DESC, a.id DESC LIMIT 1000';
    const rows = await this.dataSource.query(sql, params);
    return rows.map(this.camel);
  }

  async updateAlert(companyId: number, id: number, dto: UpdateAttendanceAlertDto, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const status = dto.status || 'acknowledged';
    const allowed = ['open', 'acknowledged', 'resolved', 'dismissed'];
    if (!allowed.includes(status)) throw new BadRequestException('Statut alerte invalide');
    const [current] = await this.dataSource.query('SELECT * FROM time_attendance_alerts WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (!current) throw new NotFoundException('Alerte introuvable');
    const [updated] = await this.dataSource.query(`
      UPDATE time_attendance_alerts SET
        status = $1,
        acknowledged_by = CASE WHEN $1 IN ('acknowledged', 'resolved', 'dismissed') THEN $2 ELSE acknowledged_by END,
        acknowledged_at = CASE WHEN $1 IN ('acknowledged', 'resolved', 'dismissed') THEN COALESCE(acknowledged_at, NOW()) ELSE NULL END,
        resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END,
        metadata = metadata || $5::jsonb,
        updated_at = NOW()
      WHERE id = $3 AND company_id = $4
      RETURNING *
    `, [status, user?.id || null, id, companyId, JSON.stringify({ note: dto.note || null })]);
    await this.audit(user?.id, 'time_alert:update', 'time_attendance_alerts', id, ipAddress, {
      companyId,
      previousStatus: current.status,
      nextStatus: status,
      note: dto.note || null,
    });
    return this.camel(updated);
  }

  async listNotificationOutbox(companyId: number, status?: string, channel?: string, limit?: number) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const params: any[] = [companyId];
    let sql = `
      SELECT n.*, a.alert_type, a.severity, a.alert_date, a.status AS alert_status,
        e.matricule, e.last_name, e.first_name, e.department
      FROM time_notification_outbox n
      LEFT JOIN time_attendance_alerts a ON a.id = n.alert_id
      LEFT JOIN employees e ON e.id = a.employee_id
      WHERE n.company_id = $1
    `;
    if (status) { params.push(status); sql += ` AND n.status = $${params.length}`; }
    if (channel) { params.push(channel); sql += ` AND n.channel = $${params.length}`; }
    params.push(this.boundedLimit(limit, 200, 1000));
    sql += ` ORDER BY n.created_at DESC, n.id DESC LIMIT $${params.length}`;
    const rows = await this.dataSource.query(sql, params);
    return rows.map(this.camel);
  }

  async dispatchNotifications(companyId: number, dto: DispatchNotificationsDto = {}, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const allowedChannels = ['internal', 'email', 'sms', 'whatsapp'];
    const channels = (dto.channels || [])
      .map((item) => String(item || '').trim().toLowerCase())
      .filter(Boolean);
    const invalidChannel = channels.find((item) => !allowedChannels.includes(item));
    if (invalidChannel) throw new BadRequestException(`Canal notification invalide: ${invalidChannel}`);

    const statuses = dto.simulateProviders ? ['queued', 'retry', 'pending_provider'] : ['queued', 'retry'];
    const params: any[] = [companyId, statuses];
    let sql = `
      SELECT *
      FROM time_notification_outbox
      WHERE company_id = $1 AND status = ANY($2::text[])
    `;
    if (channels.length) {
      params.push(channels);
      sql += ` AND channel = ANY($${params.length}::text[])`;
    }
    params.push(this.boundedLimit(dto.limit, 50, 500));
    sql += ` ORDER BY created_at ASC, id ASC LIMIT $${params.length}`;

    const rows = await this.dataSource.query(sql, params);
    const result = { total: rows.length, sent: 0, skipped: 0, failed: 0, errors: [] as any[] };

    for (const row of rows) {
      try {
        const channel = String(row.channel || '').toLowerCase();
        const providerMissing = ['sms', 'whatsapp'].includes(channel) && !dto.simulateProviders;
        const nextStatus = providerMissing ? 'pending_provider' : 'sent';
        const lastError = providerMissing ? 'Fournisseur non configure' : null;
        await this.dataSource.query(`
          UPDATE time_notification_outbox SET
            status = $1,
            attempts = attempts + $2,
            last_error = $3,
            sent_at = CASE WHEN $1 = 'sent' THEN NOW() ELSE sent_at END,
            updated_at = NOW()
          WHERE id = $4 AND company_id = $5
        `, [nextStatus, providerMissing ? 0 : 1, lastError, row.id, companyId]);
        if (nextStatus === 'sent') result.sent += 1;
        else result.skipped += 1;
      } catch (error) {
        result.failed += 1;
        result.errors.push({ id: row.id, message: error.message || 'Notification non envoyee' });
        await this.dataSource.query(`
          UPDATE time_notification_outbox SET
            status = 'failed',
            attempts = attempts + 1,
            last_error = $1,
            updated_at = NOW()
          WHERE id = $2 AND company_id = $3
        `, [error.message || 'Notification non envoyee', row.id, companyId]);
      }
    }

    await this.audit(user?.id, 'time_notifications:dispatch', 'time_notification_outbox', 0, ipAddress, {
      companyId,
      channels,
      simulateProviders: Boolean(dto.simulateProviders),
      ...result,
    });
    return result;
  }

  async startDispatchNotificationsJob(companyId: number, dto: DispatchNotificationsDto = {}, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureProcessingJobSchema();
    const rows = await this.listNotificationOutbox(companyId, undefined, undefined, this.boundedLimit(dto.limit, 50, 500));
    const [job] = await this.dataSource.query(`
      INSERT INTO time_processing_jobs (
        company_id, job_type, status, total_count, processed_count, success_count, failed_count, payload, requested_by, errors
      ) VALUES ($1,'dispatch_notifications','queued',$2,0,0,0,$3,$4,'[]'::jsonb)
      RETURNING *
    `, [companyId, rows.length, JSON.stringify(dto), user?.id || null]);
    await this.audit(user?.id, 'time_job:queued', 'time_processing_jobs', job.id, ipAddress, {
      companyId,
      jobType: 'dispatch_notifications',
      total: rows.length,
      payload: dto,
    });
    await this.queueService.enqueue({ jobId: job.id, action: 'dispatch_notifications', companyId, dto, user, ipAddress });
    return this.camelJob(job);
  }

  async listProcessingJobs(companyId: number, limit?: number) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureProcessingJobSchema();
    const rows = await this.dataSource.query(`
      SELECT *
      FROM time_processing_jobs
      WHERE company_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2
    `, [companyId, this.boundedLimit(limit, 50, 200)]);
    return rows.map((row) => this.camelJob(row));
  }

  async getProcessingJob(companyId: number, id: number) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureProcessingJobSchema();
    const [job] = await this.dataSource.query('SELECT * FROM time_processing_jobs WHERE company_id = $1 AND id = $2', [companyId, id]);
    if (!job) throw new NotFoundException('Job temps introuvable');
    return this.camelJob(job);
  }

  async cancelProcessingJob(companyId: number, id: number, user?: any, ipAddress?: string) {
    const job = await this.getProcessingJob(companyId, id);
    if (!['queued', 'running'].includes(job.status)) {
      throw new BadRequestException('Seul un job en attente ou en cours peut etre annule');
    }
    await this.dataSource.query(`
      UPDATE time_processing_jobs
      SET status = 'cancelled', finished_at = NOW(), updated_at = NOW()
      WHERE company_id = $1 AND id = $2
    `, [companyId, id]);
    await this.audit(user?.id, 'time_job:cancelled', 'time_processing_jobs', id, ipAddress, {
      companyId,
      jobType: job.jobType,
      total: job.totalCount,
    });
    return this.getProcessingJob(companyId, id);
  }

  async retryNotification(companyId: number, id: number, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const [current] = await this.dataSource.query('SELECT * FROM time_notification_outbox WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (!current) throw new NotFoundException('Notification introuvable');
    if (current.status === 'sent') throw new BadRequestException('Notification deja envoyee');
    const [updated] = await this.dataSource.query(`
      UPDATE time_notification_outbox SET
        status = 'queued',
        last_error = NULL,
        sent_at = NULL,
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      RETURNING *
    `, [id, companyId]);
    await this.audit(user?.id, 'time_notifications:retry', 'time_notification_outbox', id, ipAddress, {
      companyId,
      previousStatus: current.status,
      nextStatus: 'queued',
    });
    return this.camel(updated);
  }

  async advanceWorkflow(companyId: number, id: number, status: string, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const allowed = ['draft', 'submitted', 'hr_review', 'manager_approved', 'hr_approved', 'closed', 'rejected'];
    if (!allowed.includes(status)) throw new BadRequestException('Statut de workflow invalide');
    const [current] = await this.dataSource.query('SELECT * FROM time_attendance_days WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (!current) throw new NotFoundException('Journee temps/presence introuvable');
    const [updated] = await this.dataSource.query(`
      UPDATE time_attendance_days SET workflow_status = $1, updated_at = NOW()
      WHERE id = $2 AND company_id = $3
      RETURNING *
    `, [status, id, companyId]);
    await this.audit(user?.id, 'time_attendance:workflow', 'time_attendance_days', id, ipAddress, {
      companyId,
      previousStatus: current.workflow_status,
      nextStatus: status,
    });
    return this.camel(updated);
  }

  async exportToPayroll(companyId: number, dto: ExportAttendanceToPayrollDto, user?: any, ipAddress?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    if (!dto.month || dto.month < 1 || dto.month > 12 || !dto.year) throw new BadRequestException('Periode de paie invalide');
    await this.ensureSchema();
    await this.assertPayrollPeriodOpen(companyId, dto.month, dto.year);
    const dateFrom = `${dto.year}-${String(dto.month).padStart(2, '0')}-01`;
    const dateTo = this.monthEnd(dto.year, dto.month);
    const rows = await this.dataSource.query(`
      SELECT employee_id,
        SUM(overtime_minutes) AS overtime_minutes,
        SUM(night_minutes) AS night_minutes,
        SUM(sunday_minutes) AS sunday_minutes,
        SUM(holiday_minutes) AS holiday_minutes,
        SUM(unpaid_absence_minutes) AS unpaid_absence_minutes,
        SUM(late_minutes) AS late_minutes
      FROM time_attendance_days
      WHERE company_id = $1
        AND work_date BETWEEN $2 AND $3
        AND workflow_status IN ('hr_approved', 'closed')
      GROUP BY employee_id
    `, [companyId, dateFrom, dateTo]);

    await this.dataSource.query(`
      DELETE FROM payroll_time_inputs
      WHERE company_id = $1 AND month = $2 AND year = $3 AND notes LIKE $4
    `, [companyId, dto.month, dto.year, 'TA_AUTO:%']);

    for (const row of rows) {
      await this.dataSource.query(`
        INSERT INTO payroll_time_inputs (
          company_id, employee_id, month, year, overtime_hours, night_hours,
          sunday_hours, holiday_hours, unpaid_absence_days, late_minutes,
          notes, status, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',$12)
      `, [
        companyId,
        row.employee_id,
        dto.month,
        dto.year,
        this.minutesToHours(row.overtime_minutes),
        this.minutesToHours(row.night_minutes),
        this.minutesToHours(row.sunday_minutes),
        this.minutesToHours(row.holiday_minutes),
        this.minutesToDays(row.unpaid_absence_minutes),
        Number(row.late_minutes || 0),
        `TA_AUTO:${dto.month}/${dto.year}`,
        user?.id || null,
      ]);
    }

    await this.audit(user?.id, 'time_attendance:export_payroll', 'payroll_time_inputs', 0, ipAddress, {
      companyId,
      month: dto.month,
      year: dto.year,
      employees: rows.length,
    });
    return { month: dto.month, year: dto.year, employees: rows.length };
  }

  async dashboard(companyId: number, date = this.dateOnly(new Date())) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    const [employees] = await this.dataSource.query('SELECT COUNT(*)::int AS count FROM employees WHERE company_id = $1 AND status = $2', [companyId, 'active']);
    const [summary] = await this.dataSource.query(`
      SELECT
        COUNT(*) FILTER (WHERE presence_status = 'present')::int AS present,
        COUNT(*) FILTER (WHERE presence_status = 'absent')::int AS absent,
        COUNT(*) FILTER (WHERE late_minutes > 0)::int AS late,
        COALESCE(SUM(overtime_minutes), 0)::int AS overtime_minutes
      FROM time_attendance_days
      WHERE company_id = $1 AND work_date = $2
    `, [companyId, date]);
    const byDepartment = await this.dataSource.query(`
      SELECT COALESCE(e.department, 'Non renseigne') AS department,
        COUNT(*) FILTER (WHERE d.presence_status = 'present')::int AS present,
        COUNT(*) FILTER (WHERE d.presence_status = 'absent')::int AS absent,
        COUNT(*) FILTER (WHERE d.late_minutes > 0)::int AS late
      FROM time_attendance_days d
      JOIN employees e ON e.id = d.employee_id
      WHERE d.company_id = $1 AND d.work_date = $2
      GROUP BY COALESCE(e.department, 'Non renseigne')
      ORDER BY department
    `, [companyId, date]);
    return {
      date,
      activeEmployees: employees?.count || 0,
      present: summary?.present || 0,
      absent: summary?.absent || 0,
      late: summary?.late || 0,
      overtimeHours: this.minutesToHours(summary?.overtime_minutes || 0),
      byDepartment: byDepartment.map(this.camel),
    };
  }

  async analytics(companyId: number, dateFrom?: string, dateTo?: string) {
    if (!companyId) throw new BadRequestException('Entreprise obligatoire');
    await this.ensureSchema();
    const from = dateFrom || this.monthStart(new Date());
    const to = dateTo || this.dateOnly(new Date());
    if (new Date(`${from}T00:00:00`) > new Date(`${to}T00:00:00`)) {
      throw new BadRequestException('La date de debut doit etre inferieure a la date de fin');
    }

    const [trend, byDepartment, statusDistribution, topOvertime] = await Promise.all([
      this.dataSource.query(`
        SELECT work_date::date AS date,
          COUNT(*) FILTER (WHERE presence_status = 'present')::int AS present,
          COUNT(*) FILTER (WHERE presence_status = 'absent')::int AS absent,
          COUNT(*) FILTER (WHERE presence_status = 'leave')::int AS leaves,
          COUNT(*) FILTER (WHERE late_minutes > 0)::int AS late,
          COALESCE(SUM(worked_minutes), 0)::int AS worked_minutes,
          COALESCE(SUM(overtime_minutes), 0)::int AS overtime_minutes
        FROM time_attendance_days
        WHERE company_id = $1 AND work_date BETWEEN $2 AND $3
        GROUP BY work_date
        ORDER BY work_date
      `, [companyId, from, to]),
      this.dataSource.query(`
        SELECT COALESCE(e.department, 'Non renseigne') AS department,
          COUNT(*) FILTER (WHERE d.presence_status = 'present')::int AS present,
          COUNT(*) FILTER (WHERE d.presence_status = 'absent')::int AS absent,
          COUNT(*) FILTER (WHERE d.presence_status = 'leave')::int AS leaves,
          COUNT(*) FILTER (WHERE d.late_minutes > 0)::int AS late,
          COALESCE(SUM(d.overtime_minutes), 0)::int AS overtime_minutes
        FROM time_attendance_days d
        JOIN employees e ON e.id = d.employee_id
        WHERE d.company_id = $1 AND d.work_date BETWEEN $2 AND $3
        GROUP BY COALESCE(e.department, 'Non renseigne')
        ORDER BY department
      `, [companyId, from, to]),
      this.dataSource.query(`
        SELECT presence_status AS status, COUNT(*)::int AS count
        FROM time_attendance_days
        WHERE company_id = $1 AND work_date BETWEEN $2 AND $3
        GROUP BY presence_status
        ORDER BY status
      `, [companyId, from, to]),
      this.dataSource.query(`
        SELECT e.matricule, e.last_name, e.first_name,
          COALESCE(SUM(d.overtime_minutes), 0)::int AS overtime_minutes,
          COALESCE(SUM(d.late_minutes), 0)::int AS late_minutes
        FROM time_attendance_days d
        JOIN employees e ON e.id = d.employee_id
        WHERE d.company_id = $1 AND d.work_date BETWEEN $2 AND $3
        GROUP BY e.id, e.matricule, e.last_name, e.first_name
        HAVING COALESCE(SUM(d.overtime_minutes), 0) > 0 OR COALESCE(SUM(d.late_minutes), 0) > 0
        ORDER BY overtime_minutes DESC, late_minutes DESC
        LIMIT 10
      `, [companyId, from, to]),
    ]);

    return {
      dateFrom: from,
      dateTo: to,
      trend: trend.map((row) => ({
        ...this.camel(row),
        date: this.dateOnly(new Date(row.date)),
        workedHours: this.minutesToHours(row.worked_minutes),
        overtimeHours: this.minutesToHours(row.overtime_minutes),
      })),
      byDepartment: byDepartment.map((row) => ({
        ...this.camel(row),
        overtimeHours: this.minutesToHours(row.overtime_minutes),
      })),
      statusDistribution: statusDistribution.map(this.camel),
      topOvertime: topOvertime.map((row) => ({
        ...this.camel(row),
        overtimeHours: this.minutesToHours(row.overtime_minutes),
      })),
    };
  }

  private async calculateEmployeeDay(companyId: number, employee: Employee, date: string, user?: any) {
    const schedule = await this.resolveSchedule(companyId, employee, date);
    const leave = await this.hasApprovedLeave(employee.id, date);
    const holiday = await this.getHoliday(companyId, date);
    const eventDateTo = this.shiftCrossesMidnight(schedule.startTime, schedule.endTime)
      ? this.addDays(date, 2)
      : this.addDays(date, 1);
    const events = await this.dataSource.query(`
      SELECT *
      FROM time_clock_events
      WHERE company_id = $1
        AND employee_id = $2
        AND event_time >= $3::date
        AND event_time < $4::date
      ORDER BY event_time ASC
    `, [companyId, employee.id, date, eventDateTo]);

    const entries = events.filter((event) => event.event_type === 'entry');
    const exits = events.filter((event) => event.event_type === 'exit');
    const firstEntry = entries[0]?.event_time ? new Date(entries[0].event_time) : null;
    const lastExit = exits[exits.length - 1]?.event_time ? new Date(exits[exits.length - 1].event_time) : null;
    const workedMinutesRaw = firstEntry && lastExit && lastExit > firstEntry ? Math.round((lastExit.getTime() - firstEntry.getTime()) / 60000) : 0;
    const breakMinutes = workedMinutesRaw > 0 ? this.breakOverlapMinutes(firstEntry, lastExit, date, schedule) : 0;
    const workedMinutes = Math.max(0, workedMinutesRaw - breakMinutes);

    const scheduledStart = this.scheduleDateTime(date, schedule.startTime);
    const scheduledEnd = this.scheduleDateTime(date, schedule.endTime, schedule.startTime);
    const lateMinutes = firstEntry && schedule.isWorkingDay
      ? Math.max(0, Math.round((firstEntry.getTime() - scheduledStart.getTime()) / 60000) - schedule.graceLateMinutes)
      : 0;
    const earlyDepartureMinutes = lastExit && schedule.isWorkingDay
      ? Math.max(0, Math.round((scheduledEnd.getTime() - lastExit.getTime()) / 60000))
      : 0;
    const expectedMinutes = schedule.isWorkingDay ? schedule.expectedMinutes : 0;
    const normalMinutes = Math.min(workedMinutes, expectedMinutes || workedMinutes);
    const overtimeMinutes = Math.max(0, workedMinutes - expectedMinutes - schedule.overtimeThresholdMinutes);
    const weekday = this.weekday(date);
    const nightMinutes = this.nightMinutes(firstEntry, lastExit, breakMinutes);
    const sundayMinutes = weekday === 7 ? workedMinutes : 0;
    const holidayMinutes = holiday ? workedMinutes : 0;
    const absent = schedule.isWorkingDay && !leave && workedMinutes === 0;
    const presenceStatus = leave ? 'leave' : absent ? 'absent' : workedMinutes > 0 ? 'present' : 'off';
    const unpaidAbsenceMinutes = absent ? expectedMinutes : 0;

    const [day] = await this.dataSource.query(`
      INSERT INTO time_attendance_days (
        company_id, employee_id, work_date, profile_id, expected_minutes,
        worked_minutes, normal_minutes, break_minutes, overtime_minutes,
        night_minutes, sunday_minutes, holiday_minutes, late_minutes,
        early_departure_minutes, unpaid_absence_minutes, presence_status,
        workflow_status, calculation_snapshot, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'draft',$17,$18)
      ON CONFLICT (employee_id, work_date) DO UPDATE SET
        profile_id = EXCLUDED.profile_id,
        expected_minutes = EXCLUDED.expected_minutes,
        worked_minutes = EXCLUDED.worked_minutes,
        normal_minutes = EXCLUDED.normal_minutes,
        break_minutes = EXCLUDED.break_minutes,
        overtime_minutes = EXCLUDED.overtime_minutes,
        night_minutes = EXCLUDED.night_minutes,
        sunday_minutes = EXCLUDED.sunday_minutes,
        holiday_minutes = EXCLUDED.holiday_minutes,
        late_minutes = EXCLUDED.late_minutes,
        early_departure_minutes = EXCLUDED.early_departure_minutes,
        unpaid_absence_minutes = EXCLUDED.unpaid_absence_minutes,
        presence_status = EXCLUDED.presence_status,
        calculation_snapshot = EXCLUDED.calculation_snapshot,
        updated_at = NOW()
      RETURNING *
    `, [
      companyId,
      employee.id,
      date,
      schedule.profileId,
      expectedMinutes,
      workedMinutes,
      normalMinutes,
      breakMinutes,
      overtimeMinutes,
      nightMinutes,
      sundayMinutes,
      holidayMinutes,
      lateMinutes,
      earlyDepartureMinutes,
      unpaidAbsenceMinutes,
      presenceStatus,
      JSON.stringify({ schedule, leave, holiday, eventIds: events.map((event) => event.id), generatedAt: new Date().toISOString() }),
      user?.id || null,
    ]);
    return this.camel(day);
  }

  private async resolveSchedule(companyId: number, employee: Employee, date: string): Promise<Schedule> {
    const [planned] = await this.dataSource.query(`
      SELECT s.*, p.code, p.name, p.grace_late_minutes, p.overtime_threshold_minutes
      FROM time_schedule_entries s
      LEFT JOIN time_work_profiles p ON p.id = s.profile_id
      WHERE s.company_id = $1 AND s.employee_id = $2 AND s.work_date = $3::date
      LIMIT 1
    `, [companyId, employee.id, date]);
    if (planned) {
      if (planned.status === 'rest' || !planned.profile_id) {
        return {
          ...this.defaultSchedule(date),
          profileId: null,
          profileCode: planned.shift_label || 'REST',
          profileName: planned.shift_label || 'Repos planifie',
          isWorkingDay: false,
          expectedMinutes: 0,
        };
      }
      const [plannedDay] = await this.dataSource.query(`
        SELECT *
        FROM time_work_profile_days
        WHERE profile_id = $1 AND weekday = $2
        LIMIT 1
      `, [planned.profile_id, this.weekday(date)]);
      return {
        profileId: planned.profile_id,
        profileCode: planned.code || 'PLANNED',
        profileName: planned.name || planned.shift_label || 'Planning',
        graceLateMinutes: Number(planned.grace_late_minutes || 0),
        overtimeThresholdMinutes: Number(planned.overtime_threshold_minutes || 0),
        isWorkingDay: planned.status !== 'rest',
        startTime: planned.planned_start || plannedDay?.start_time || '08:00',
        endTime: planned.planned_end || plannedDay?.end_time || '17:00',
        breakStart: plannedDay?.break_start || undefined,
        breakEnd: plannedDay?.break_end || undefined,
        expectedMinutes: Number(plannedDay?.expected_minutes || this.expectedMinutes(planned.planned_start || plannedDay?.start_time || '08:00', planned.planned_end || plannedDay?.end_time || '17:00', plannedDay?.break_start, plannedDay?.break_end)),
      };
    }

    const [assignment] = await this.dataSource.query(`
      SELECT a.*, p.code, p.name, p.grace_late_minutes, p.overtime_threshold_minutes
      FROM time_employee_work_profile_assignments a
      JOIN time_work_profiles p ON p.id = a.profile_id
      WHERE a.company_id = $1
        AND a.is_active = true
        AND p.is_active = true
        AND a.effective_from <= $2::date
        AND (a.effective_to IS NULL OR a.effective_to >= $2::date)
        AND (
          a.employee_id = $3
          OR (a.employee_id IS NULL AND a.department IS NOT NULL AND a.department = $4)
          OR (a.employee_id IS NULL AND a.position IS NOT NULL AND a.position = $5)
          OR (a.employee_id IS NULL AND a.department IS NULL AND a.position IS NULL)
        )
      ORDER BY
        CASE
          WHEN a.employee_id = $3 THEN 1
          WHEN a.position IS NOT NULL THEN 2
          WHEN a.department IS NOT NULL THEN 3
          ELSE 4
        END,
        a.effective_from DESC
      LIMIT 1
    `, [companyId, date, employee.id, employee.department || null, employee.position || null]);

    if (!assignment) return this.defaultSchedule(date);

    const [day] = await this.dataSource.query(`
      SELECT *
      FROM time_work_profile_days
      WHERE profile_id = $1 AND weekday = $2
      LIMIT 1
    `, [assignment.profile_id, this.weekday(date)]);
    if (!day) return { ...this.defaultSchedule(date), profileId: assignment.profile_id, profileCode: assignment.code, profileName: assignment.name };
    return {
      profileId: assignment.profile_id,
      profileCode: assignment.code,
      profileName: assignment.name,
      graceLateMinutes: Number(assignment.grace_late_minutes || 0),
      overtimeThresholdMinutes: Number(assignment.overtime_threshold_minutes || 0),
      isWorkingDay: day.is_working_day !== false,
      startTime: day.start_time || '08:00',
      endTime: day.end_time || '17:00',
      breakStart: day.break_start || undefined,
      breakEnd: day.break_end || undefined,
      expectedMinutes: Number(day.expected_minutes || this.expectedMinutes(day.start_time, day.end_time, day.break_start, day.break_end)),
    };
  }

  private defaultSchedule(date: string): Schedule {
    const isWorkingDay = this.weekday(date) <= 5;
    return {
      profileId: null,
      profileCode: 'DEFAULT',
      profileName: 'Horaire administratif standard',
      graceLateMinutes: 5,
      overtimeThresholdMinutes: 0,
      isWorkingDay,
      startTime: '08:00',
      endTime: '17:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      expectedMinutes: isWorkingDay ? 480 : 0,
    };
  }

  private async upsertProfileDay(profileId: number, day: WorkProfileDayDto) {
    const expected = day.expectedMinutes ?? this.expectedMinutes(day.startTime || '08:00', day.endTime || '17:00', day.breakStart, day.breakEnd);
    await this.dataSource.query(`
      INSERT INTO time_work_profile_days (
        profile_id, weekday, is_working_day, start_time, end_time, break_start, break_end, expected_minutes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [
      profileId,
      day.weekday,
      day.isWorkingDay !== false,
      day.startTime || '08:00',
      day.endTime || '17:00',
      day.breakStart || null,
      day.breakEnd || null,
      expected,
    ]);
  }

  private async seedStandardProfileDays(profileId: number) {
    const existing = await this.dataSource.query('SELECT COUNT(*)::int AS count FROM time_work_profile_days WHERE profile_id = $1', [profileId]);
    if (existing[0]?.count) return;
    for (let weekday = 1; weekday <= 7; weekday += 1) {
      await this.upsertProfileDay(profileId, {
        weekday,
        isWorkingDay: weekday <= 5,
        startTime: '08:00',
        endTime: '17:00',
        breakStart: '12:00',
        breakEnd: '13:00',
        expectedMinutes: weekday <= 5 ? 480 : 0,
      });
    }
  }

  private async getWorkProfile(id: number) {
    const [profile] = await this.dataSource.query('SELECT * FROM time_work_profiles WHERE id = $1', [id]);
    const days = await this.dataSource.query('SELECT * FROM time_work_profile_days WHERE profile_id = $1 ORDER BY weekday', [id]);
    return { ...this.camel(profile), days: days.map(this.camel) };
  }

  private async ensureProfile(companyId: number, profileId: number) {
    const [profile] = await this.dataSource.query('SELECT * FROM time_work_profiles WHERE id = $1 AND company_id = $2', [profileId, companyId]);
    if (!profile) throw new NotFoundException('Profil horaire introuvable');
    return profile;
  }

  private async ensureTeam(companyId: number, teamId: number) {
    const [team] = await this.dataSource.query('SELECT * FROM time_shift_teams WHERE id = $1 AND company_id = $2', [teamId, companyId]);
    if (!team) throw new NotFoundException('Equipe introuvable');
    return team;
  }

  private countAlertResult(result: { created: number; updated: number; queued: number }, saved: any) {
    if (saved.inserted) result.created += 1;
    else result.updated += 1;
    result.queued += Number(saved.queued || 0);
  }

  private async upsertAlert(companyId: number, alert: any, user?: any) {
    const [saved] = await this.dataSource.query(`
      INSERT INTO time_attendance_alerts (
        company_id, employee_id, attendance_day_id, schedule_entry_id,
        alert_type, severity, alert_date, title, message, status, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open',$10)
      ON CONFLICT (company_id, employee_id, alert_type, alert_date) DO UPDATE SET
        attendance_day_id = EXCLUDED.attendance_day_id,
        schedule_entry_id = EXCLUDED.schedule_entry_id,
        severity = EXCLUDED.severity,
        title = EXCLUDED.title,
        message = EXCLUDED.message,
        metadata = time_attendance_alerts.metadata || EXCLUDED.metadata,
        status = CASE
          WHEN time_attendance_alerts.status IN ('resolved', 'dismissed') THEN time_attendance_alerts.status
          ELSE 'open'
        END,
        updated_at = NOW()
      RETURNING *, (xmax = 0) AS inserted
    `, [
      companyId,
      alert.employeeId,
      alert.attendanceDayId || null,
      alert.scheduleEntryId || null,
      alert.alertType,
      alert.severity,
      alert.alertDate,
      alert.title,
      alert.message,
      JSON.stringify(alert.metadata || {}),
    ]);
    const inserted = saved?.inserted === true || saved?.inserted === 't' || saved?.inserted === 'true';
    const queued = inserted ? await this.queueAlertNotifications(companyId, saved.id, alert, user) : 0;
    return { ...saved, inserted, queued };
  }

  private async queueAlertNotifications(companyId: number, alertId: number, alert: any, user?: any) {
    const employee = alert.employee || {};
    const channels = [
      { channel: 'internal', recipient: String(alert.employeeId), status: 'queued' },
      employee.email ? { channel: 'email', recipient: employee.email, status: 'queued' } : null,
      employee.phone ? { channel: 'sms', recipient: employee.phone, status: 'pending_provider' } : null,
      employee.phone ? { channel: 'whatsapp', recipient: employee.phone, status: 'pending_provider' } : null,
    ].filter(Boolean);
    for (const item of channels) {
      await this.dataSource.query(`
        INSERT INTO time_notification_outbox (
          company_id, alert_id, channel, recipient, subject, payload, status, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [
        companyId,
        alertId,
        item.channel,
        item.recipient,
        alert.title,
        JSON.stringify({ message: alert.message, alertType: alert.alertType, severity: alert.severity }),
        item.status,
        user?.id || null,
      ]);
    }
    return channels.length;
  }

  private async ensureRotation(companyId: number, rotationPatternId: number) {
    const [rotation] = await this.dataSource.query('SELECT * FROM time_rotation_patterns WHERE id = $1 AND company_id = $2 AND is_active = true', [rotationPatternId, companyId]);
    if (!rotation) throw new NotFoundException('Rotation introuvable');
    return rotation;
  }

  private async processQueuedJob(payload: TimeAttendanceQueuePayload) {
    const [startedJob] = await this.dataSource.query(`
      UPDATE time_processing_jobs
      SET status = 'running', started_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'queued'
      RETURNING *
    `, [payload.jobId]);
    if (!startedJob) return;

    try {
      if (payload.action === 'calculate') {
        const result = await this.calculateAttendance(payload.companyId, payload.dto, payload.user, payload.ipAddress);
        const [completedJob] = await this.dataSource.query(`
          UPDATE time_processing_jobs
          SET processed_count = $2,
              success_count = $3,
              failed_count = $4,
              status = CASE WHEN $4 > 0 THEN 'completed_with_errors' ELSE 'completed' END,
              errors = $5::jsonb,
              finished_at = NOW(),
              updated_at = NOW()
          WHERE id = $1 AND status = 'running'
          RETURNING *
        `, [payload.jobId, result.total, result.success, result.failed, JSON.stringify(result.errors || [])]);
        if (!completedJob) return;
      } else if (payload.action === 'detect_alerts') {
        const result = await this.detectAlerts(payload.companyId, payload.dto, payload.user, payload.ipAddress);
        const [completedJob] = await this.dataSource.query(`
          UPDATE time_processing_jobs
          SET processed_count = $2,
              success_count = $3,
              failed_count = 0,
              status = 'completed',
              errors = '[]'::jsonb,
              finished_at = NOW(),
              updated_at = NOW()
          WHERE id = $1 AND status = 'running'
          RETURNING *
        `, [payload.jobId, result.total, result.created + result.updated]);
        if (!completedJob) return;
      } else if (payload.action === 'dispatch_notifications') {
        const result = await this.dispatchNotifications(payload.companyId, payload.dto, payload.user, payload.ipAddress);
        const [completedJob] = await this.dataSource.query(`
          UPDATE time_processing_jobs
          SET processed_count = $2,
              success_count = $3,
              failed_count = $4,
              status = CASE WHEN $4 > 0 THEN 'completed_with_errors' ELSE 'completed' END,
              errors = $5::jsonb,
              finished_at = NOW(),
              updated_at = NOW()
          WHERE id = $1 AND status = 'running'
          RETURNING *
        `, [payload.jobId, result.total, result.sent, result.failed, JSON.stringify(result.errors || [])]);
        if (!completedJob) return;
      }
    } catch (error) {
      const message = error?.message || 'Erreur inconnue';
      const [failedJob] = await this.dataSource.query(`
        UPDATE time_processing_jobs
        SET status = 'failed',
            failed_count = failed_count + 1,
            errors = errors || $2::jsonb,
            finished_at = NOW(),
            updated_at = NOW()
        WHERE id = $1 AND status = 'running'
        RETURNING *
      `, [payload.jobId, JSON.stringify([{ message }])]);
      if (failedJob) {
        await this.audit(payload.user?.id || null, 'time_job:failed', 'time_processing_jobs', payload.jobId, payload.ipAddress || '', {
          companyId: payload.companyId,
          action: payload.action,
          message,
        });
      }
      throw error;
    }

    const finalJob = await this.getProcessingJob(payload.companyId, payload.jobId);
    await this.audit(payload.user?.id || null, 'time_job:completed', 'time_processing_jobs', payload.jobId, payload.ipAddress || '', {
      companyId: payload.companyId,
      jobType: finalJob.jobType,
      total: finalJob.totalCount,
      success: finalJob.successCount,
      failed: finalJob.failedCount,
      status: finalJob.status,
    });
  }

  private async resolveScheduleEmployees(companyId: number, dto: GenerateScheduleDto) {
    if (dto.employeeIds?.length) {
      const employees: Employee[] = [];
      for (const id of dto.employeeIds) employees.push(await this.ensureEmployee(companyId, id));
      return employees;
    }
    if (dto.department) {
      return this.employeeRepo.find({ where: { companyId, department: dto.department, status: 'active' as any }, order: { lastName: 'ASC' } });
    }
    return this.resolveEmployees(companyId);
  }

  private planFromRotation(rotation: any, date: string) {
    const cycleLength = Number(rotation.work_days || 0) + Number(rotation.rest_days || 0);
    if (cycleLength < 1) throw new BadRequestException('Cycle de rotation invalide');
    const daysSinceStart = this.daysBetween(rotation.cycle_start_date, date);
    const rotationDay = ((daysSinceStart % cycleLength) + cycleLength) % cycleLength;
    if (rotationDay >= Number(rotation.work_days || 0)) {
      return { status: 'rest', profileId: null, shiftLabel: 'Repos rotation', rotationDay: rotationDay + 1 };
    }
    const useNight = rotation.rotation_type === 'day_night' && rotation.night_profile_id && rotationDay % 2 === 1;
    return {
      status: 'planned',
      profileId: useNight ? Number(rotation.night_profile_id) : Number(rotation.day_profile_id),
      shiftLabel: useNight ? 'Nuit' : 'Jour',
      rotationDay: rotationDay + 1,
    };
  }

  private async getProfileDayPlan(profileId: number, date: string) {
    const [day] = await this.dataSource.query(`
      SELECT *
      FROM time_work_profile_days
      WHERE profile_id = $1 AND weekday = $2
      LIMIT 1
    `, [profileId, this.weekday(date)]);
    if (!day || day.is_working_day === false) return { startTime: null, endTime: null };
    return { startTime: day.start_time || '08:00', endTime: day.end_time || '17:00' };
  }

  private async ensureEmployee(companyId: number, employeeId: number) {
    const employee = await this.employeeRepo.findOne({ where: { id: employeeId } });
    if (!employee || Number(employee.companyId) !== Number(companyId)) throw new NotFoundException('Employe introuvable pour cette entreprise');
    return employee;
  }

  private async resolveEmployeeByReference(companyId: number, reference?: string) {
    const value = String(reference || '').trim();
    if (!value) throw new BadRequestException('Reference employe obligatoire');
    const employee = await this.employeeRepo.findOne({ where: { matricule: value } });
    if (!employee || Number(employee.companyId) !== Number(companyId)) throw new NotFoundException(`Employe introuvable: ${value}`);
    return employee;
  }

  private async resolveEmployees(companyId: number, employeeId?: number) {
    if (employeeId) return [await this.ensureEmployee(companyId, employeeId)];
    return this.employeeRepo.find({ where: { companyId, status: 'active' as any }, order: { lastName: 'ASC' } });
  }

  private async hasApprovedLeave(employeeId: number, date: string) {
    const [leave] = await this.dataSource.query(`
      SELECT id FROM leave_requests
      WHERE employee_id = $1 AND status = 'approved' AND start_date <= $2::date AND end_date >= $2::date
      LIMIT 1
    `, [employeeId, date]);
    return Boolean(leave);
  }

  private async getHoliday(companyId: number, date: string) {
    const [holiday] = await this.dataSource.query('SELECT * FROM time_holidays WHERE company_id = $1 AND holiday_date = $2::date', [companyId, date]);
    return holiday || null;
  }

  private expectedMinutes(start: string, end: string, breakStart?: string, breakEnd?: string) {
    const startMinutes = this.timeToMinutes(start);
    let endMinutes = this.timeToMinutes(end);
    if (endMinutes <= startMinutes) endMinutes += 1440;
    const total = Math.max(0, endMinutes - startMinutes);
    let breakMinutes = 0;
    if (breakStart && breakEnd) {
      let breakStartMinutes = this.timeToMinutes(breakStart);
      let breakEndMinutes = this.timeToMinutes(breakEnd);
      if (breakStartMinutes < startMinutes) breakStartMinutes += 1440;
      if (breakEndMinutes <= breakStartMinutes) breakEndMinutes += 1440;
      breakMinutes = Math.max(0, breakEndMinutes - breakStartMinutes);
    }
    return Math.max(0, total - breakMinutes);
  }

  private breakOverlapMinutes(start: Date, end: Date, date: string, schedule: Schedule) {
    if (!schedule.breakStart || !schedule.breakEnd) return 0;
    const breakStart = this.scheduleDateTime(date, schedule.breakStart, schedule.startTime);
    const breakEnd = this.scheduleDateTime(date, schedule.breakEnd, schedule.breakStart);
    return Math.max(0, Math.round((Math.min(end.getTime(), breakEnd.getTime()) - Math.max(start.getTime(), breakStart.getTime())) / 60000));
  }

  private nightMinutes(start: Date | null, end: Date | null, breakMinutes: number) {
    if (!start || !end || end <= start) return 0;
    let minutes = 0;
    const cursor = new Date(start);
    while (cursor < end) {
      const hour = cursor.getHours();
      if (hour >= 22 || hour < 5) minutes += 1;
      cursor.setMinutes(cursor.getMinutes() + 1);
    }
    return Math.max(0, minutes - Math.min(minutes, breakMinutes));
  }

  private timeToMinutes(value: string) {
    const [hours, minutes] = String(value || '00:00').split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }

  private shiftCrossesMidnight(start: string, end: string) {
    return this.timeToMinutes(end) <= this.timeToMinutes(start);
  }

  private scheduleDateTime(date: string, time: string, referenceTime?: string) {
    const result = new Date(`${date}T${time || '00:00'}`);
    if (referenceTime && this.timeToMinutes(time) <= this.timeToMinutes(referenceTime)) {
      result.setDate(result.getDate() + 1);
    }
    return result;
  }

  private weekday(date: string) {
    const day = this.parseDateUtc(date).getUTCDay();
    return day === 0 ? 7 : day;
  }

  private addDays(date: string, days: number) {
    const result = this.parseDateUtc(date);
    result.setUTCDate(result.getUTCDate() + days);
    return this.dateOnly(result);
  }

  private datesBetween(dateFrom: string, dateTo: string) {
    const dates: string[] = [];
    const cursor = this.parseDateUtc(dateFrom);
    const end = this.parseDateUtc(dateTo);
    if (cursor > end) throw new BadRequestException('La date de debut doit etre inferieure a la date de fin');
    while (cursor <= end) {
      dates.push(this.dateOnly(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  }

  private daysBetween(dateFrom: string | Date, dateTo: string | Date) {
    const start = this.parseDateUtc(dateFrom);
    const end = this.parseDateUtc(dateTo);
    return Math.floor((end.getTime() - start.getTime()) / 86400000);
  }

  private parseDateUtc(value: string | Date) {
    const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
    return new Date(`${text}T00:00:00.000Z`);
  }

  private dateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private monthEnd(year: number, month: number) {
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  }

  private monthStart(date: Date) {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1)).toISOString().slice(0, 10);
  }

  private minutesToHours(value: any) {
    return Number((Number(value || 0) / 60).toFixed(2));
  }

  private minutesToDays(value: any) {
    return Number((Number(value || 0) / 480).toFixed(2));
  }

  private boundedLimit(value: any, fallback: number, max: number) {
    const parsed = Number(value || fallback);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(Math.floor(parsed), max);
  }

  private clockExternalReference(source: string, terminalId: string | null, employeeId: number, eventType: string, eventTime: string) {
    return [source || 'api_terminal', terminalId || 'terminal', employeeId, eventType, eventTime].join(':');
  }

  private async assertPayrollPeriodOpen(companyId: number, month: number, year: number) {
    const [period] = await this.dataSource.query(`
      SELECT status
      FROM payroll_periods
      WHERE company_id = $1 AND month = $2 AND year = $3
      LIMIT 1
    `, [companyId, month, year]);
    if (period?.status === 'closed') throw new BadRequestException('La periode de paie est deja cloturee');
  }

  private camel(row: any) {
    if (!row) return row;
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_m, letter) => letter.toUpperCase()),
      value,
    ]));
  }

  private audit(userId: number | null, action: string, entity: string, entityId: number, ipAddress: string, details: any) {
    return this.auditRepo.save(this.auditRepo.create({
      userId: userId || null,
      action,
      entity,
      entityId,
      ipAddress,
      details,
    }));
  }

  private async ensureSchema() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS sites (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS time_work_profiles (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        code VARCHAR(80) NOT NULL,
        name VARCHAR(255) NOT NULL,
        profile_type VARCHAR(50) DEFAULT 'standard',
        weekly_hours DECIMAL(8, 2) DEFAULT 40,
        grace_late_minutes INT DEFAULT 5,
        overtime_threshold_minutes INT DEFAULT 0,
        flexible_arrival_from TIME,
        flexible_arrival_to TIME,
        metadata JSONB DEFAULT '{}'::jsonb,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, code)
      )
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS time_work_profile_days (
        id SERIAL PRIMARY KEY,
        profile_id INT REFERENCES time_work_profiles(id) ON DELETE CASCADE,
        weekday INT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
        is_working_day BOOLEAN DEFAULT TRUE,
        start_time TIME,
        end_time TIME,
        break_start TIME,
        break_end TIME,
        expected_minutes INT DEFAULT 0
      )
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS time_holidays (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        holiday_date DATE NOT NULL,
        name VARCHAR(255) NOT NULL,
        is_paid BOOLEAN DEFAULT TRUE,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, holiday_date)
      )
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS time_shift_teams (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        site_id INT REFERENCES sites(id) ON DELETE SET NULL,
        code VARCHAR(80) NOT NULL,
        name VARCHAR(255) NOT NULL,
        rotation_pattern VARCHAR(100),
        metadata JSONB DEFAULT '{}'::jsonb,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, code)
      )
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS time_rotation_patterns (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        code VARCHAR(80) NOT NULL,
        name VARCHAR(255) NOT NULL,
        rotation_type VARCHAR(50) DEFAULT 'work_rest',
        work_days INT NOT NULL DEFAULT 5,
        rest_days INT NOT NULL DEFAULT 2,
        cycle_start_date DATE NOT NULL,
        day_profile_id INT REFERENCES time_work_profiles(id) ON DELETE RESTRICT,
        night_profile_id INT REFERENCES time_work_profiles(id) ON DELETE SET NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, code)
      )
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS time_employee_work_profile_assignments (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        profile_id INT REFERENCES time_work_profiles(id) ON DELETE CASCADE,
        employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
        department VARCHAR(100),
        position VARCHAR(100),
        team_id INT REFERENCES time_shift_teams(id) ON DELETE SET NULL,
        effective_from DATE NOT NULL,
        effective_to DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS time_clock_events (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
        event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('entry', 'exit')),
        event_time TIMESTAMP NOT NULL,
        method VARCHAR(50) DEFAULT 'manual',
        terminal_id VARCHAR(100),
        external_reference VARCHAR(160),
        location_label VARCHAR(255),
        latitude DECIMAL(10, 7),
        longitude DECIMAL(10, 7),
        source VARCHAR(50) DEFAULT 'manual',
        metadata JSONB DEFAULT '{}'::jsonb,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await this.dataSource.query(`ALTER TABLE time_clock_events ADD COLUMN IF NOT EXISTS external_reference VARCHAR(160)`);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS time_attendance_days (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
        work_date DATE NOT NULL,
        profile_id INT REFERENCES time_work_profiles(id) ON DELETE SET NULL,
        expected_minutes INT DEFAULT 0,
        worked_minutes INT DEFAULT 0,
        normal_minutes INT DEFAULT 0,
        break_minutes INT DEFAULT 0,
        overtime_minutes INT DEFAULT 0,
        night_minutes INT DEFAULT 0,
        sunday_minutes INT DEFAULT 0,
        holiday_minutes INT DEFAULT 0,
        late_minutes INT DEFAULT 0,
        early_departure_minutes INT DEFAULT 0,
        unpaid_absence_minutes INT DEFAULT 0,
        presence_status VARCHAR(30) DEFAULT 'draft',
        workflow_status VARCHAR(30) DEFAULT 'draft',
        calculation_snapshot JSONB DEFAULT '{}'::jsonb,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(employee_id, work_date)
      )
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS time_schedule_entries (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
        work_date DATE NOT NULL,
        profile_id INT REFERENCES time_work_profiles(id) ON DELETE SET NULL,
        team_id INT REFERENCES time_shift_teams(id) ON DELETE SET NULL,
        rotation_pattern_id INT REFERENCES time_rotation_patterns(id) ON DELETE SET NULL,
        shift_label VARCHAR(120),
        planned_start TIME,
        planned_end TIME,
        status VARCHAR(30) DEFAULT 'planned',
        rotation_day INT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(employee_id, work_date)
      )
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS time_attendance_alerts (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        employee_id INT REFERENCES employees(id) ON DELETE CASCADE,
        attendance_day_id INT REFERENCES time_attendance_days(id) ON DELETE SET NULL,
        schedule_entry_id INT REFERENCES time_schedule_entries(id) ON DELETE SET NULL,
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) DEFAULT 'medium',
        alert_date DATE NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        status VARCHAR(30) DEFAULT 'open',
        metadata JSONB DEFAULT '{}'::jsonb,
        detected_at TIMESTAMP DEFAULT NOW(),
        acknowledged_by INT REFERENCES users(id),
        acknowledged_at TIMESTAMP,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, employee_id, alert_type, alert_date)
      )
    `);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS time_notification_outbox (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        alert_id INT REFERENCES time_attendance_alerts(id) ON DELETE CASCADE,
        channel VARCHAR(30) NOT NULL,
        recipient VARCHAR(255),
        subject VARCHAR(255),
        payload JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(30) DEFAULT 'queued',
        attempts INT DEFAULT 0,
        last_error TEXT,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        sent_at TIMESTAMP
      )
    `);
    await this.dataSource.query(`ALTER TABLE time_notification_outbox ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS time_approval_workflows (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        steps JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INT REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_time_clock_events_employee_time ON time_clock_events(employee_id, event_time)`);
    await this.dataSource.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_time_clock_events_external_ref ON time_clock_events(company_id, source, external_reference) WHERE external_reference IS NOT NULL`);
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_time_attendance_days_company_date ON time_attendance_days(company_id, work_date)`);
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_time_assignments_scope ON time_employee_work_profile_assignments(company_id, employee_id, department, position, effective_from, effective_to)`);
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_time_schedule_company_date ON time_schedule_entries(company_id, work_date)`);
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_time_schedule_employee_date ON time_schedule_entries(employee_id, work_date)`);
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_time_alerts_company_status_date ON time_attendance_alerts(company_id, status, alert_date)`);
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_time_alerts_employee_date ON time_attendance_alerts(employee_id, alert_date)`);
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_time_notification_outbox_status ON time_notification_outbox(status, channel, created_at)`);
    await this.ensureProcessingJobSchema();
  }

  private async ensureProcessingJobSchema() {
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS time_processing_jobs (
        id SERIAL PRIMARY KEY,
        company_id INT REFERENCES companies(id) ON DELETE CASCADE,
        job_type VARCHAR(50) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'queued',
        total_count INT DEFAULT 0,
        processed_count INT DEFAULT 0,
        success_count INT DEFAULT 0,
        failed_count INT DEFAULT 0,
        payload JSONB DEFAULT '{}'::jsonb,
        requested_by INT REFERENCES users(id),
        errors JSONB DEFAULT '[]'::jsonb,
        started_at TIMESTAMP,
        finished_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_time_processing_jobs_company_created ON time_processing_jobs(company_id, created_at DESC)`);
  }

  private camelJob(job: any) {
    return {
      id: job.id,
      companyId: job.company_id,
      jobType: job.job_type,
      status: job.status,
      totalCount: job.total_count,
      processedCount: job.processed_count,
      successCount: job.success_count,
      failedCount: job.failed_count,
      payload: job.payload || {},
      requestedBy: job.requested_by,
      errors: job.errors || [],
      startedAt: job.started_at,
      finishedAt: job.finished_at,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      progress: job.total_count ? Math.round((Number(job.processed_count) / Math.max(1, Number(job.total_count))) * 100) : 0,
    };
  }
}
