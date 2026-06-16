import * as assert from 'assert';
import { PayrollEngineService } from '../src/payroll/payroll-engine.service';

const employee = {
  id: 101,
  matricule: 'EMPTEST',
  lastName: 'Test',
  firstName: 'Payroll',
  department: 'Finance',
  position: 'Analyste',
  companyId: 1,
  baseSalary: 900,
  company: { id: 1, name: 'TestCo' },
  contracts: [
    { id: 77, type: 'CDI', salary: 1000, status: 'active', startDate: '2026-01-01', endDate: null },
  ],
};

function createEngine() {
  const dataSource = {
    getRepository: () => ({
      findOne: async () => employee,
    }),
    query: async () => [],
  } as any;

  const engine = new PayrollEngineService(dataSource);
  (engine as any).getCurrency = async () => ({ primaryCurrency: 'CDF', rate: 2000 });
  (engine as any).getRubrics = async () => [];
  (engine as any).getLegalRates = async () => ({
    CNSS_EMPLOYEE: 5,
    CNSS_EMPLOYER: 13,
    INPP_EMPLOYER: 1,
    ONEM_EMPLOYER: 0.2,
  });
  (engine as any).getIprBrackets = async () => [{ min: 0, max: null, rate: 15, fixedAmount: 0 }];
  (engine as any).computeTimeDetails = async () => [];
  return engine;
}

async function testCoreCalculation() {
  const engine = createEngine();
  const result = await engine.compute({
    employeeId: 101,
    month: 6,
    year: 2026,
    variables: [{ code: 'BONUS', label: 'Bonus', amount: 100, currency: 'CDF' }],
  });

  assert.strictEqual(result.baseSalary, 1000);
  assert.strictEqual(result.totalAllowances, 100);
  assert.strictEqual(result.grossSalary, 1100);
  assert.strictEqual(result.taxableSalary, 1100);
  assert.strictEqual(result.totalDeductions, 207.5);
  assert.strictEqual(result.netSalary, 892.5);
  assert.strictEqual(result.employerContributions, 143.2);
  assert.strictEqual(result.snapshot.version, 'RDC-PAYROLL-ENGINE-V1');
  assert.strictEqual(result.snapshot.contract.id, 77);
  assert.ok(result.details.some((detail) => detail.code === 'CNSS_EMPLOYEE' && detail.amount === 50));
  assert.ok(result.details.some((detail) => detail.code === 'IPR' && detail.amount === 157.5));
}

async function testUsdConversion() {
  const engine = createEngine();
  const result = await engine.compute({
    employeeId: 101,
    month: 6,
    year: 2026,
    baseSalary: 1000,
    variables: [{ code: 'USD_BONUS', label: 'Bonus USD', amount: 10, currency: 'USD' }],
  });

  assert.strictEqual(result.totalAllowances, 20000);
  assert.strictEqual(result.grossSalary, 21000);
  assert.strictEqual(result.exchangeRate, 2000);
}

async function testVariableDeductionAndNonTaxableAllowance() {
  const engine = createEngine();
  const result = await engine.compute({
    employeeId: 101,
    month: 6,
    year: 2026,
    baseSalary: 1000,
    variables: [
      { code: 'TRANSPORT', label: 'Transport', amount: 100, currency: 'CDF', type: 'allowance', taxable: false },
      { code: 'ADVANCE', label: 'Avance', amount: 50, currency: 'CDF', type: 'deduction' },
    ],
  });

  assert.strictEqual(result.grossSalary, 1100);
  assert.strictEqual(result.taxableSalary, 1000);
  assert.strictEqual(result.totalDeductions, 242.5);
  assert.strictEqual(result.netSalary, 857.5);
  assert.ok(result.details.some((detail) => detail.code === 'ADVANCE' && detail.type === 'deduction' && detail.amount === 50));
}

function testProgressiveTax() {
  const engine = createEngine();
  const tax = (engine as any).computeProgressiveTax(1500, [
    { min: 0, max: 1000, rate: 10, fixedAmount: 0 },
    { min: 1000, max: null, rate: 20, fixedAmount: 0 },
  ]);
  assert.strictEqual(tax, 200);
}

async function testTimeInputs() {
  const engine = createEngine();
  (engine as any).computeTimeDetails = async () => [
    {
      code: 'OVERTIME',
      label: 'Heures supplementaires',
      category: 'time_attendance',
      type: 'allowance',
      baseAmount: 10,
      amount: 130,
      employerAmount: 0,
      rate: 130,
      metadata: { source: 'time_input', taxable: true },
    },
    {
      code: 'UNPAID_ABSENCE',
      label: 'Absence',
      category: 'time_attendance',
      type: 'deduction',
      baseAmount: 50,
      amount: 50,
      employerAmount: 0,
      rate: null,
      metadata: { source: 'time_input' },
    },
  ];

  const result = await engine.compute({ employeeId: 101, month: 6, year: 2026, baseSalary: 1000 });
  assert.strictEqual(result.grossSalary, 1130);
  assert.strictEqual(result.totalDeductions, 262);
  assert.strictEqual(result.netSalary, 868);
  assert.ok(result.snapshot.timeInputs.some((item) => item.code === 'OVERTIME'));
}

async function run() {
  await testCoreCalculation();
  await testUsdConversion();
  await testVariableDeductionAndNonTaxableAllowance();
  await testTimeInputs();
  testProgressiveTax();
  console.log('Payroll engine tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
