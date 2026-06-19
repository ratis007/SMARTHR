import * as assert from 'assert';
import { TimeAttendanceService } from '../src/time-attendance/time-attendance.service';

const employee = {
  id: 501,
  matricule: 'TATT501',
  lastName: 'Presence',
  firstName: 'Test',
  department: 'Operations',
  position: 'Agent',
  email: 'presence.test@example.test',
  phone: '+243000000001',
  companyId: 1,
  status: 'active',
};

function createQueueService() {
  return {
    registerProcessor: () => undefined,
    enqueue: async (_payload: any) => undefined,
  };
}

function createService() {
  const insertedRows: any[] = [];
  const dataSource = {
    query: async (sql: string, params: any[] = []) => {
      if (sql.includes('FROM time_employee_work_profile_assignments')) {
        return [{
          profile_id: 10,
          code: 'ADMIN',
          name: 'Horaire administratif',
          grace_late_minutes: 5,
          overtime_threshold_minutes: 0,
        }];
      }
      if (sql.includes('FROM time_schedule_entries')) return [];
      if (sql.includes('FROM time_work_profile_days')) {
        return [{
          is_working_day: true,
          start_time: '08:00',
          end_time: '17:00',
          break_start: '12:00',
          break_end: '13:00',
          expected_minutes: 480,
        }];
      }
      if (sql.includes('FROM leave_requests')) return [];
      if (sql.includes('FROM time_holidays')) return [];
      if (sql.includes('FROM time_clock_events')) {
        return [
          { id: 1, event_type: 'entry', event_time: '2026-06-15T08:10:00' },
          { id: 2, event_type: 'exit', event_time: '2026-06-15T18:00:00' },
        ];
      }
      if (sql.includes('INSERT INTO time_attendance_days')) {
        const row = {
          id: 9001,
          company_id: params[0],
          employee_id: params[1],
          work_date: params[2],
          profile_id: params[3],
          expected_minutes: params[4],
          worked_minutes: params[5],
          normal_minutes: params[6],
          break_minutes: params[7],
          overtime_minutes: params[8],
          night_minutes: params[9],
          sunday_minutes: params[10],
          holiday_minutes: params[11],
          late_minutes: params[12],
          early_departure_minutes: params[13],
          unpaid_absence_minutes: params[14],
          presence_status: params[15],
        };
        insertedRows.push(row);
        return [row];
      }
      throw new Error(`Unexpected SQL in time attendance test: ${sql}`);
    },
  };
  const employeeRepo = { findOne: async () => employee, find: async () => [employee] };
  const auditRepo = { create: (row: any) => row, save: async (row: any) => row };
  return { service: new TimeAttendanceService(dataSource as any, employeeRepo as any, auditRepo as any, createQueueService() as any), insertedRows };
}

function createNightShiftService() {
  const insertedRows: any[] = [];
  const dataSource = {
    query: async (sql: string, params: any[] = []) => {
      if (sql.includes('FROM time_employee_work_profile_assignments')) {
        return [{
          profile_id: 11,
          code: 'NIGHT',
          name: 'Equipe nuit',
          grace_late_minutes: 5,
          overtime_threshold_minutes: 0,
        }];
      }
      if (sql.includes('FROM time_schedule_entries')) return [];
      if (sql.includes('FROM time_work_profile_days')) {
        return [{
          is_working_day: true,
          start_time: '18:00',
          end_time: '06:00',
          break_start: null,
          break_end: null,
          expected_minutes: 0,
        }];
      }
      if (sql.includes('FROM leave_requests')) return [];
      if (sql.includes('FROM time_holidays')) return [];
      if (sql.includes('FROM time_clock_events')) {
        assert.deepStrictEqual(params.slice(0, 4), [1, employee.id, '2026-06-15', '2026-06-17']);
        return [
          { id: 11, event_type: 'entry', event_time: '2026-06-15T18:00:00' },
          { id: 12, event_type: 'exit', event_time: '2026-06-16T06:00:00' },
        ];
      }
      if (sql.includes('INSERT INTO time_attendance_days')) {
        const row = {
          id: 9002,
          company_id: params[0],
          employee_id: params[1],
          work_date: params[2],
          profile_id: params[3],
          expected_minutes: params[4],
          worked_minutes: params[5],
          normal_minutes: params[6],
          break_minutes: params[7],
          overtime_minutes: params[8],
          night_minutes: params[9],
          sunday_minutes: params[10],
          holiday_minutes: params[11],
          late_minutes: params[12],
          early_departure_minutes: params[13],
          unpaid_absence_minutes: params[14],
          presence_status: params[15],
        };
        insertedRows.push(row);
        return [row];
      }
      throw new Error(`Unexpected SQL in night shift test: ${sql}`);
    },
  };
  const employeeRepo = { findOne: async () => employee, find: async () => [employee] };
  const auditRepo = { create: (row: any) => row, save: async (row: any) => row };
  return { service: new TimeAttendanceService(dataSource as any, employeeRepo as any, auditRepo as any, createQueueService() as any), insertedRows };
}

function createImportService() {
  const insertedEvents: any[] = [];
  const dataSource = {
    query: async (sql: string, params: any[] = []) => {
      if (/CREATE TABLE|ALTER TABLE|CREATE (UNIQUE )?INDEX/.test(sql)) return [];
      if (sql.includes('INSERT INTO time_clock_events')) {
        const row = {
          id: 7001,
          company_id: params[0],
          employee_id: params[1],
          event_type: params[2],
          event_time: params[3],
          method: params[4],
          terminal_id: params[5],
          source: params[9],
          external_reference: params[11],
        };
        insertedEvents.push(row);
        return [row];
      }
      throw new Error(`Unexpected SQL in terminal import test: ${sql}`);
    },
  };
  const employeeRepo = { findOne: async () => employee, find: async () => [employee] };
  const auditRepo = { create: (row: any) => row, save: async (row: any) => row };
  return { service: new TimeAttendanceService(dataSource as any, employeeRepo as any, auditRepo as any, createQueueService() as any), insertedEvents };
}

function createScheduleService() {
  const scheduleRows: any[] = [];
  const dataSource = {
    query: async (sql: string, params: any[] = []) => {
      if (/CREATE TABLE|ALTER TABLE|CREATE (UNIQUE )?INDEX/.test(sql)) return [];
      if (sql.includes('FROM time_rotation_patterns')) {
        return [{
          id: 44,
          company_id: 1,
          code: 'ROT-2-1',
          name: 'Rotation 2/1',
          rotation_type: 'work_rest',
          work_days: 2,
          rest_days: 1,
          cycle_start_date: '2026-06-01',
          day_profile_id: 10,
          night_profile_id: null,
        }];
      }
      if (sql.includes('FROM time_work_profile_days')) {
        return [{
          is_working_day: true,
          start_time: '08:00',
          end_time: '17:00',
          break_start: '12:00',
          break_end: '13:00',
          expected_minutes: 480,
        }];
      }
      if (sql.includes('INSERT INTO time_schedule_entries')) {
        const row = {
          id: 8000 + scheduleRows.length,
          employee_id: params[1],
          work_date: params[2],
          profile_id: params[3],
          rotation_pattern_id: params[5],
          shift_label: params[6],
          status: params[9],
          rotation_day: params[10],
        };
        scheduleRows.push(row);
        return [row];
      }
      throw new Error(`Unexpected SQL in schedule generation test: ${sql}`);
    },
  };
  const employeeRepo = { findOne: async () => employee, find: async () => [employee] };
  const auditRepo = { create: (row: any) => row, save: async (row: any) => row };
  return { service: new TimeAttendanceService(dataSource as any, employeeRepo as any, auditRepo as any, createQueueService() as any), scheduleRows };
}

function createScheduleUpdateService() {
  const scheduleRow: any = {
    id: 8101,
    company_id: 1,
    employee_id: employee.id,
    work_date: '2026-06-10',
    profile_id: 10,
    team_id: null,
    rotation_pattern_id: 44,
    shift_label: 'Jour',
    planned_start: '08:00',
    planned_end: '17:00',
    status: 'planned',
    metadata: {},
  };
  const dataSource = {
    query: async (sql: string, params: any[] = []) => {
      if (/CREATE TABLE|ALTER TABLE|CREATE (UNIQUE )?INDEX/.test(sql)) return [];
      if (sql.includes('SELECT * FROM time_schedule_entries WHERE id = $1')) return [scheduleRow];
      if (sql.includes('SELECT * FROM time_work_profiles')) {
        return [{ id: params[0], company_id: params[1], code: 'NIGHT', name: 'Horaire nuit' }];
      }
      if (sql.includes('FROM time_work_profile_days')) {
        return [{ is_working_day: true, start_time: '18:00', end_time: '06:00', expected_minutes: 720 }];
      }
      if (sql.includes('UPDATE time_schedule_entries SET')) {
        Object.assign(scheduleRow, {
          employee_id: params[0],
          work_date: params[1],
          profile_id: params[2],
          team_id: params[3],
          shift_label: params[4],
          planned_start: params[5],
          planned_end: params[6],
          status: params[7],
          metadata: JSON.parse(params[8]),
        });
        return [scheduleRow];
      }
      throw new Error(`Unexpected SQL in schedule update test: ${sql}`);
    },
  };
  const employeeRepo = { findOne: async () => employee, find: async () => [employee] };
  const auditRepo = { create: (row: any) => row, save: async (row: any) => row };
  return { service: new TimeAttendanceService(dataSource as any, employeeRepo as any, auditRepo as any, createQueueService() as any), scheduleRow };
}

function createScheduleListService() {
  let capturedParams: any[] = [];
  const dataSource = {
    query: async (sql: string, params: any[] = []) => {
      if (/CREATE TABLE|ALTER TABLE|CREATE (UNIQUE )?INDEX/.test(sql)) return [];
      if (sql.includes('FROM time_schedule_entries s')) {
        capturedParams = params;
        return [{
          id: 8201,
          company_id: 1,
          employee_id: employee.id,
          work_date: '2026-06-18',
          team_id: 7,
          matricule: employee.matricule,
          last_name: employee.lastName,
          first_name: employee.firstName,
        }];
      }
      throw new Error(`Unexpected SQL in schedule list test: ${sql}`);
    },
  };
  const employeeRepo = { findOne: async () => employee, find: async () => [employee] };
  const auditRepo = { create: (row: any) => row, save: async (row: any) => row };
  return { service: new TimeAttendanceService(dataSource as any, employeeRepo as any, auditRepo as any, createQueueService() as any), getParams: () => capturedParams };
}

function createAlertService() {
  const alerts: any[] = [];
  const outbox: any[] = [];
  const dataSource = {
    query: async (sql: string, params: any[] = []) => {
      if (/CREATE TABLE|ALTER TABLE|CREATE (UNIQUE )?INDEX/.test(sql)) return [];
      if (sql.includes('d.late_minutes > 0')) {
        return [{
          attendance_day_id: 990,
          employee_id: employee.id,
          alert_date: '2026-06-18',
          late_minutes: 35,
          matricule: employee.matricule,
          last_name: employee.lastName,
          first_name: employee.firstName,
          email: employee.email,
          phone: employee.phone,
        }];
      }
      if (sql.includes('INSERT INTO time_attendance_alerts')) {
        const row = {
          id: 8801,
          company_id: params[0],
          employee_id: params[1],
          attendance_day_id: params[2],
          alert_type: params[4],
          severity: params[5],
          alert_date: params[6],
          title: params[7],
          message: params[8],
          inserted: true,
        };
        alerts.push(row);
        return [row];
      }
      if (sql.includes('INSERT INTO time_notification_outbox')) {
        outbox.push({ alert_id: params[1], channel: params[2], recipient: params[3], status: params[6] });
        return [];
      }
      throw new Error(`Unexpected SQL in alert detection test: ${sql}`);
    },
  };
  const employeeRepo = { findOne: async () => employee, find: async () => [employee] };
  const auditRepo = { create: (row: any) => row, save: async (row: any) => row };
  return { service: new TimeAttendanceService(dataSource as any, employeeRepo as any, auditRepo as any, createQueueService() as any), alerts, outbox };
}

function createNotificationService() {
  const notifications: any[] = [
    { id: 1, company_id: 1, alert_id: 8801, channel: 'internal', recipient: String(employee.id), subject: 'Retard detecte', status: 'queued', attempts: 0 },
    { id: 2, company_id: 1, alert_id: 8801, channel: 'email', recipient: employee.email, subject: 'Retard detecte', status: 'queued', attempts: 0 },
    { id: 3, company_id: 1, alert_id: 8801, channel: 'sms', recipient: employee.phone, subject: 'Retard detecte', status: 'pending_provider', attempts: 0 },
    { id: 4, company_id: 1, alert_id: 8801, channel: 'whatsapp', recipient: employee.phone, subject: 'Retard detecte', status: 'pending_provider', attempts: 0 },
  ];
  const dataSource = {
    query: async (sql: string, params: any[] = []) => {
      if (/CREATE TABLE|ALTER TABLE|CREATE (UNIQUE )?INDEX/.test(sql)) return [];
      if (sql.includes('FROM time_notification_outbox n')) return notifications;
      if (sql.includes('FROM time_notification_outbox') && sql.includes('status = ANY')) {
        const statuses = params[1] || [];
        const channels = Array.isArray(params[2]) ? params[2] : null;
        return notifications.filter((row) =>
          row.company_id === params[0] &&
          statuses.includes(row.status) &&
          (!channels || channels.includes(row.channel)),
        );
      }
      if (sql.includes('SELECT * FROM time_notification_outbox WHERE id = $1')) {
        return notifications.filter((row) => row.id === params[0] && row.company_id === params[1]);
      }
      if (sql.includes('UPDATE time_notification_outbox SET') && sql.includes('status = $1')) {
        const row = notifications.find((item) => item.id === params[3] && item.company_id === params[4]);
        if (row) {
          row.status = params[0];
          row.attempts += params[1];
          row.last_error = params[2];
          if (params[0] === 'sent') row.sent_at = 'now';
        }
        return row ? [row] : [];
      }
      if (sql.includes("status = 'queued'")) {
        const row = notifications.find((item) => item.id === params[0] && item.company_id === params[1]);
        if (row) {
          row.status = 'queued';
          row.last_error = null;
          row.sent_at = null;
        }
        return row ? [row] : [];
      }
      throw new Error(`Unexpected SQL in notification outbox test: ${sql}`);
    },
  };
  const employeeRepo = { findOne: async () => employee, find: async () => [employee] };
  const auditRepo = { create: (row: any) => row, save: async (row: any) => row };
  return { service: new TimeAttendanceService(dataSource as any, employeeRepo as any, auditRepo as any, createQueueService() as any), notifications };
}

function createProcessingJobService() {
  const enqueued: any[] = [];
  const dataSource = {
    query: async (sql: string, params: any[] = []) => {
      if (/CREATE TABLE|ALTER TABLE|CREATE (UNIQUE )?INDEX/.test(sql)) return [];
      if (sql.includes('INSERT INTO time_processing_jobs')) {
        return [{
          id: 9901,
          company_id: params[0],
          job_type: 'calculate',
          status: 'queued',
          total_count: params[1],
          processed_count: 0,
          success_count: 0,
          failed_count: 0,
          payload: JSON.parse(params[2]),
          requested_by: params[3],
          errors: [],
        }];
      }
      throw new Error(`Unexpected SQL in processing job test: ${sql}`);
    },
  };
  const employeeRepo = { findOne: async () => employee, find: async () => [employee] };
  const auditRepo = { create: (row: any) => row, save: async (row: any) => row };
  const queueService = {
    registerProcessor: () => undefined,
    enqueue: async (payload: any) => { enqueued.push(payload); },
  };
  return { service: new TimeAttendanceService(dataSource as any, employeeRepo as any, auditRepo as any, queueService as any), enqueued };
}

function createFailedProcessingJobService() {
  const jobUpdates: any[] = [];
  const auditRows: any[] = [];
  const dataSource = {
    query: async (sql: string, params: any[] = []) => {
      if (sql.includes('UPDATE time_processing_jobs')) {
        jobUpdates.push({ sql, params });
        if (sql.includes("status = 'running'")) return [{ id: params[0], status: 'running' }];
        return [];
      }
      throw new Error(`Unexpected SQL in failed processing job test: ${sql}`);
    },
  };
  const employeeRepo = { findOne: async () => employee, find: async () => [employee] };
  const auditRepo = {
    create: (row: any) => row,
    save: async (row: any) => {
      auditRows.push(row);
      return row;
    },
  };
  const queueService = {
    registerProcessor: () => undefined,
    enqueue: async (_payload: any) => undefined,
  };
  const service = new TimeAttendanceService(dataSource as any, employeeRepo as any, auditRepo as any, queueService as any);
  (service as any).calculateAttendance = async () => {
    throw new Error('Calcul impossible');
  };
  return { service, jobUpdates, auditRows };
}

function createCancelledProcessingJobService() {
  const jobUpdates: any[] = [];
  let calculateCalled = false;
  const dataSource = {
    query: async (sql: string, params: any[] = []) => {
      if (sql.includes('UPDATE time_processing_jobs')) {
        jobUpdates.push({ sql, params });
        return [];
      }
      throw new Error(`Unexpected SQL in cancelled processing job test: ${sql}`);
    },
  };
  const employeeRepo = { findOne: async () => employee, find: async () => [employee] };
  const auditRepo = { create: (row: any) => row, save: async (row: any) => row };
  const queueService = {
    registerProcessor: () => undefined,
    enqueue: async (_payload: any) => undefined,
  };
  const service = new TimeAttendanceService(dataSource as any, employeeRepo as any, auditRepo as any, queueService as any);
  (service as any).calculateAttendance = async () => {
    calculateCalled = true;
  };
  return { service, jobUpdates, wasCalculateCalled: () => calculateCalled };
}

function createCancelledDuringProcessingJobService() {
  const jobUpdates: any[] = [];
  const auditRows: any[] = [];
  let calculateCalled = false;
  const dataSource = {
    query: async (sql: string, params: any[] = []) => {
      if (sql.includes('UPDATE time_processing_jobs')) {
        jobUpdates.push({ sql, params });
        if (jobUpdates.length === 1) return [{ id: params[0], status: 'running' }];
        return [];
      }
      throw new Error(`Unexpected SQL in cancelled during processing job test: ${sql}`);
    },
  };
  const employeeRepo = { findOne: async () => employee, find: async () => [employee] };
  const auditRepo = {
    create: (row: any) => row,
    save: async (row: any) => {
      auditRows.push(row);
      return row;
    },
  };
  const queueService = {
    registerProcessor: () => undefined,
    enqueue: async (_payload: any) => undefined,
  };
  const service = new TimeAttendanceService(dataSource as any, employeeRepo as any, auditRepo as any, queueService as any);
  (service as any).calculateAttendance = async () => {
    calculateCalled = true;
    return { total: 1, success: 1, failed: 0, errors: [] };
  };
  return { service, jobUpdates, auditRows, wasCalculateCalled: () => calculateCalled };
}

async function testDailyCalculation() {
  const { service, insertedRows } = createService();
  const day = await (service as any).calculateEmployeeDay(1, employee, '2026-06-15', { id: 9 });

  assert.strictEqual(day.employeeId, employee.id);
  assert.strictEqual(day.profileId, 10);
  assert.strictEqual(day.expectedMinutes, 480);
  assert.strictEqual(day.breakMinutes, 60);
  assert.strictEqual(day.workedMinutes, 530);
  assert.strictEqual(day.normalMinutes, 480);
  assert.strictEqual(day.overtimeMinutes, 50);
  assert.strictEqual(day.lateMinutes, 5);
  assert.strictEqual(day.earlyDepartureMinutes, 0);
  assert.strictEqual(day.unpaidAbsenceMinutes, 0);
  assert.strictEqual(day.presenceStatus, 'present');
  assert.strictEqual(insertedRows.length, 1);
}

async function testConfigurationRequiresCompany() {
  const { service } = createService();
  await assert.rejects(
    () => service.getConfiguration(undefined as any),
    /Entreprise obligatoire/,
  );
}

async function testNightShiftCalculationAcrossMidnight() {
  const { service, insertedRows } = createNightShiftService();
  const day = await (service as any).calculateEmployeeDay(1, employee, '2026-06-15', { id: 9 });

  assert.strictEqual(day.profileId, 11);
  assert.strictEqual(day.expectedMinutes, 720);
  assert.strictEqual(day.workedMinutes, 720);
  assert.strictEqual(day.normalMinutes, 720);
  assert.strictEqual(day.overtimeMinutes, 0);
  assert.strictEqual(day.nightMinutes, 420);
  assert.strictEqual(day.lateMinutes, 0);
  assert.strictEqual(day.earlyDepartureMinutes, 0);
  assert.strictEqual(day.presenceStatus, 'present');
  assert.strictEqual(insertedRows.length, 1);
}

async function testTerminalImport() {
  const { service, insertedEvents } = createImportService();
  const result = await service.importClockEvents(1, {
    source: 'api_terminal',
    terminalId: 'BIO-01',
    batchReference: 'BATCH-TEST',
    events: [
      { matricule: employee.matricule, eventType: 'entry', eventTime: '2026-06-18T08:00:00' },
    ],
  }, { id: 9 }, '127.0.0.1');

  assert.strictEqual(result.total, 1);
  assert.strictEqual(result.success, 1);
  assert.strictEqual(result.failed, 0);
  assert.strictEqual(insertedEvents.length, 1);
  assert.strictEqual(insertedEvents[0].employee_id, employee.id);
  assert.strictEqual(insertedEvents[0].terminal_id, 'BIO-01');
  assert.strictEqual(insertedEvents[0].source, 'api_terminal');
}

async function testScheduleGeneration() {
  const { service, scheduleRows } = createScheduleService();
  const result = await service.generateSchedule(1, {
    dateFrom: '2026-06-01',
    dateTo: '2026-06-03',
    rotationPatternId: 44,
    overwrite: true,
  }, { id: 9 }, '127.0.0.1');

  assert.strictEqual(result.total, 3);
  assert.strictEqual(result.success, 3);
  assert.strictEqual(result.failed, 0);
  assert.deepStrictEqual(scheduleRows.map((row) => row.status), ['planned', 'planned', 'rest']);
  assert.deepStrictEqual(scheduleRows.map((row) => row.rotation_day), [1, 2, 3]);
}

async function testScheduleManualUpdate() {
  const { service, scheduleRow } = createScheduleUpdateService();
  const result = await service.updateScheduleEntry(1, 8101, {
    workDate: '2026-06-11',
    profileId: 12,
    plannedStart: '18:00',
    plannedEnd: '06:00',
    shiftLabel: 'Nuit manuelle',
    status: 'planned',
    recalculate: false,
  }, { id: 9 }, '127.0.0.1');

  assert.strictEqual(result.workDate, '2026-06-11');
  assert.strictEqual(result.profileId, 12);
  assert.strictEqual(result.plannedStart, '18:00');
  assert.strictEqual(result.plannedEnd, '06:00');
  assert.strictEqual(result.shiftLabel, 'Nuit manuelle');
  assert.strictEqual(scheduleRow.metadata.manualOverride, true);
}

async function testScheduleListFiltering() {
  const { service, getParams } = createScheduleListService();
  const rows = await service.listSchedule(1, '2026-06-01', '2026-06-30', employee.id, 7);

  assert.strictEqual(rows.length, 1);
  assert.deepStrictEqual(getParams(), [1, '2026-06-01', '2026-06-30', employee.id, 7]);
}

async function testAlertDetection() {
  const { service, alerts, outbox } = createAlertService();
  const result = await service.detectAlerts(1, {
    dateFrom: '2026-06-18',
    dateTo: '2026-06-18',
    alertTypes: ['late'],
  }, { id: 9 }, '127.0.0.1');

  assert.strictEqual(result.created, 1);
  assert.strictEqual(result.updated, 0);
  assert.strictEqual(result.queued, 4);
  assert.strictEqual(alerts[0].alert_type, 'late');
  assert.strictEqual(alerts[0].severity, 'high');
  assert.deepStrictEqual(outbox.map((row) => row.channel), ['internal', 'email', 'sms', 'whatsapp']);
}

async function testNotificationDispatch() {
  const { service, notifications } = createNotificationService();

  const first = await service.dispatchNotifications(1, { limit: 10, simulateProviders: false }, { id: 9 }, '127.0.0.1');
  assert.strictEqual(first.total, 2);
  assert.strictEqual(first.sent, 2);
  assert.strictEqual(first.skipped, 0);
  assert.strictEqual(notifications[0].status, 'sent');
  assert.strictEqual(notifications[1].status, 'sent');
  assert.strictEqual(notifications[2].status, 'pending_provider');

  const retry = await service.retryNotification(1, 3, { id: 9 }, '127.0.0.1');
  assert.strictEqual(retry.status, 'queued');

  const second = await service.dispatchNotifications(1, { limit: 10, simulateProviders: true }, { id: 9 }, '127.0.0.1');
  assert.strictEqual(second.total, 2);
  assert.strictEqual(second.sent, 2);
  assert.strictEqual(notifications[2].status, 'sent');
  assert.strictEqual(notifications[3].status, 'sent');
}

async function testProcessingJobQueueing() {
  const { service, enqueued } = createProcessingJobService();
  const job = await service.startCalculateJob(1, {
    dateFrom: '2026-06-01',
    dateTo: '2026-06-02',
  }, { id: 9 }, '127.0.0.1');

  assert.strictEqual(job.id, 9901);
  assert.strictEqual(job.jobType, 'calculate');
  assert.strictEqual(job.totalCount, 2);
  assert.strictEqual(enqueued.length, 1);
  assert.strictEqual(enqueued[0].action, 'calculate');
}

async function testProcessingJobFailureAudit() {
  const { service, jobUpdates, auditRows } = createFailedProcessingJobService();
  await assert.rejects(
    () => (service as any).processQueuedJob({
      jobId: 9902,
      action: 'calculate',
      companyId: 1,
      dto: { dateFrom: '2026-06-01', dateTo: '2026-06-01' },
      user: { id: 9 },
      ipAddress: '127.0.0.1',
    }),
    /Calcul impossible/,
  );

  assert.strictEqual(jobUpdates.length, 2);
  assert.strictEqual(auditRows.length, 1);
  assert.strictEqual(auditRows[0].action, 'time_job:failed');
  assert.strictEqual(auditRows[0].entityId, 9902);
  assert.strictEqual(auditRows[0].details.message, 'Calcul impossible');
}

async function testCancelledProcessingJobIsNotRun() {
  const { service, jobUpdates, wasCalculateCalled } = createCancelledProcessingJobService();
  await (service as any).processQueuedJob({
    jobId: 9903,
    action: 'calculate',
    companyId: 1,
    dto: { dateFrom: '2026-06-01', dateTo: '2026-06-01' },
    user: { id: 9 },
    ipAddress: '127.0.0.1',
  });

  assert.strictEqual(jobUpdates.length, 1);
  assert.match(jobUpdates[0].sql, /status = 'queued'/);
  assert.strictEqual(wasCalculateCalled(), false);
}

async function testCancelledRunningJobDoesNotBecomeCompleted() {
  const { service, jobUpdates, auditRows, wasCalculateCalled } = createCancelledDuringProcessingJobService();
  await (service as any).processQueuedJob({
    jobId: 9904,
    action: 'calculate',
    companyId: 1,
    dto: { dateFrom: '2026-06-01', dateTo: '2026-06-01' },
    user: { id: 9 },
    ipAddress: '127.0.0.1',
  });

  assert.strictEqual(wasCalculateCalled(), true);
  assert.strictEqual(jobUpdates.length, 2);
  assert.match(jobUpdates[1].sql, /status = 'running'/);
  assert.strictEqual(auditRows.some((row) => row.action === 'time_job:completed'), false);
}

async function run() {
  await testConfigurationRequiresCompany();
  await testDailyCalculation();
  await testNightShiftCalculationAcrossMidnight();
  await testTerminalImport();
  await testScheduleGeneration();
  await testScheduleManualUpdate();
  await testScheduleListFiltering();
  await testAlertDetection();
  await testNotificationDispatch();
  await testProcessingJobQueueing();
  await testProcessingJobFailureAudit();
  await testCancelledProcessingJobIsNotRun();
  await testCancelledRunningJobDoesNotBecomeCompleted();
  console.log('Time attendance engine tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
