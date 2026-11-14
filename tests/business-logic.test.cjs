const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'Sistema_Condominios_Prototipo_Corregido.html'), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, `No se encontró ${name} en el prototipo`);
  const open = html.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = open; i < html.length; i++) {
    const char = html[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth++;
    if (char === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`No se pudo extraer ${name}`);
}

function extractAssignedFunction(name) {
  const marker = `${name} = function(`;
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, `No se encontró la asignación de ${name} en el prototipo`);
  const functionStart = start + name.length + 3;
  const open = html.indexOf('{', functionStart);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = open; i < html.length; i++) {
    const char = html[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth++;
    if (char === '}' && --depth === 0) return `function${html.slice(functionStart + 8, i + 1)}`;
  }
  throw new Error(`No se pudo extraer ${name}`);
}

const db = {
  buildings: [
    { id: 't-a', condo: 'c-a' },
    { id: 't-b', condo: 'c-a' },
    { id: 't-c', condo: 'c-b' },
  ],
};
const periodMatches = new Function(`${extractFunction('periodMatches')}; return periodMatches;`)();
const quotaAppliesToUnit = new Function('db', 'periodMatches', `${extractFunction('quotaAppliesToUnit')}; return quotaAppliesToUnit;`)(db, periodMatches);
const roundMoney = new Function(`${extractFunction('roundMoney')}; return roundMoney;`)();
const addMonthsISO = new Function(`${extractFunction('addMonthsISO')}; return addMonthsISO;`)();
const firstContractDue = new Function('addMonthsISO', `${extractFunction('firstContractDue')}; return firstContractDue;`)(addMonthsISO);
const calculateMonthlyPayment = new Function(`${extractFunction('calculateMonthlyPayment')}; return calculateMonthlyPayment;`)();
let generatedId = 0;
const buildContractSchedule = new Function('roundMoney', 'id', 'calculateMonthlyPayment', 'firstContractDue', `return (${extractAssignedFunction('buildContractSchedule')});`)(roundMoney, () => `test-${++generatedId}`, calculateMonthlyPayment, firstContractDue);
const invoiceBalance = new Function('roundMoney', `${extractFunction('invoiceBalance')}; return invoiceBalance;`)(roundMoney);

const unitA = { id: 'u-a', building: 't-a' };
const unitB = { id: 'u-b', building: 't-b' };
const unitC = { id: 'u-c', building: 't-c' };
const quota = (fields = {}) => ({ estado: 'Activa', frecuencia: 'Mensual', ...fields });

test('aplica cuotas generales únicamente dentro de su condominio', () => {
  assert.equal(quotaAppliesToUnit(quota({ condo: 'c-a' }), unitA, '2026-11'), true);
  assert.equal(quotaAppliesToUnit(quota({ condo: 'c-a' }), unitC, '2026-11'), false);
});

test('respeta torre y apartamento definidos en el alcance', () => {
  assert.equal(quotaAppliesToUnit(quota({ building: 't-a' }), unitA, '2026-11'), true);
  assert.equal(quotaAppliesToUnit(quota({ building: 't-a' }), unitB, '2026-11'), false);
  assert.equal(quotaAppliesToUnit(quota({ unit: 'u-a' }), unitA, '2026-11'), true);
  assert.equal(quotaAppliesToUnit(quota({ unit: 'u-a' }), unitB, '2026-11'), false);
});

test('respeta frecuencia bimestral, trimestral, anual y única', () => {
  assert.equal(quotaAppliesToUnit(quota({ frecuencia: 'Bimestral', desde: '2026-01-01' }), unitA, '2026-03'), true);
  assert.equal(quotaAppliesToUnit(quota({ frecuencia: 'Bimestral', desde: '2026-01-01' }), unitA, '2026-02'), false);
  assert.equal(quotaAppliesToUnit(quota({ frecuencia: 'Trimestral', desde: '2026-01-01' }), unitA, '2026-04'), true);
  assert.equal(quotaAppliesToUnit(quota({ frecuencia: 'Anual', desde: '2026-01-01' }), unitA, '2027-01'), true);
  assert.equal(quotaAppliesToUnit(quota({ frecuencia: 'Único', desde: '2026-01-01' }), unitA, '2026-01'), true);
  assert.equal(quotaAppliesToUnit(quota({ frecuencia: 'Único', desde: '2026-01-01' }), unitA, '2026-02'), false);
});

test('respeta vigencia e ignora reglas inactivas o unidades sin torre válida', () => {
  assert.equal(quotaAppliesToUnit(quota({ desde: '2026-12-01' }), unitA, '2026-11'), false);
  assert.equal(quotaAppliesToUnit(quota({ hasta: '2026-10-31' }), unitA, '2026-11'), false);
  assert.equal(quotaAppliesToUnit(quota({ estado: 'Inactiva' }), unitA, '2026-11'), false);
  assert.equal(quotaAppliesToUnit(quota(), { id: 'orphan', building: 'missing' }, '2026-11'), false);
  assert.equal(quotaAppliesToUnit(quota(), unitA, 'invalid'), false);
});

test('un abono de RD$4,000 reduce una factura de RD$10,000 a RD$6,000', () => {
  assert.equal(invoiceBalance({ monto: 10000, paidAmount: 4000, status: 'Parcial' }), 6000);
});

test('la compra financiada genera 60 cuotas mensuales y mantiene la inicial separada', () => {
  const rows = buildContractSchedule({ id: 'c-1', tipo_contrato: 'Compra financiada', fecha_inicio: '2026-12-01', dia_vencimiento: 5, precio_total: 3000000, inicial: 600000, duracion_meses: 60, cuota_mensual: 40000, interes_anual: 0 });
  assert.equal(rows.filter(row => row.kind === 'Compra financiada').length, 60);
  assert.equal(rows.filter(row => row.kind === 'Inicial de compra').length, 1);
  assert.equal(rows[0].amount, 600000);
  assert.equal(rows[1].date, '2026-12-05');
  assert.equal(rows[1].amount, 40000);
});

test('el alquiler genera 12 rentas separadas del depósito de garantía', () => {
  const rows = buildContractSchedule({ id: 'c-2', tipo_contrato: 'Alquiler', fecha_inicio: '2026-12-01', dia_vencimiento: 5, renta_mensual: 25000, deposito_garantia: 25000, duracion_meses: 12 });
  assert.equal(rows.filter(row => row.kind === 'Alquiler').length, 12);
  assert.equal(rows.filter(row => row.kind === 'Depósito de garantía').length, 1);
  assert.equal(rows.filter(row => row.kind === 'Alquiler').every(row => row.amount === 25000), true);
  assert.equal(rows[1].date, '2026-12-05');
});

test('el vencimiento de fin de mes se ajusta al último día de febrero bisiesto', () => {
  assert.equal(firstContractDue('2024-01-31', 31, 0), '2024-02-29');
});
