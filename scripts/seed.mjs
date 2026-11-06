// Gera db/db.seed.json com dados fictícios para a demonstração (@faker-js/faker, locale pt_BR).
// Uso: npm run seed [-- --anchor=yyyy-MM-dd]
//
// A semente do faker e a data de referência são fixas, então o resultado é reproduzível. As datas
// são geradas como se hoje fosse `anchorDate` e avançadas para o mês atual ao carregar o seed
// (src/app/data-access/local/seed-dates.ts). Por isso todos os dias ficam entre 1 e 28.
import { fakerPT_BR as faker } from '@faker-js/faker';
import { pbkdf2Sync } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { DEFAULT_CATEGORIES } from '../src/app/features/categories/domain/default-categories.ts';
import { DEMO_CREDENTIALS } from '../src/app/data-access/local/demo-credentials.ts';

const FAKER_SEED = 2026;
const DEFAULT_ANCHOR_DATE = '2026-11-05';
/** Meses de histórico, contando o atual. */
const HISTORY_MONTHS = 6;

const PBKDF2_ITERATIONS = 600_000;

const anchorArg = process.argv.find((arg) => arg.startsWith('--anchor='));
const anchorDate = anchorArg ? anchorArg.slice('--anchor='.length) : DEFAULT_ANCHOR_DATE;
if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) {
  throw new Error(`Data de referência inválida: ${anchorDate}`);
}

faker.seed(FAKER_SEED);

// ---------------------------------------------------------------------------------------------
// Datas (dias de 1 a 28, meses relativos à data de referência)

const [anchorYear, anchorMonth, anchorDay] = anchorDate.split('-').map(Number);

/** Mês `offset` meses antes (negativo) ou depois do mês de referência, como `{ year, month }`. */
function monthAt(offset) {
  const total = anchorYear * 12 + anchorMonth - 1 + offset;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function isoMonth({ year, month }) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function isoDate(month, day) {
  if (day < 1 || day > 28) {
    throw new RangeError(`Dia fora de 1–28: ${day}`);
  }
  return `${isoMonth(month)}-${String(day).padStart(2, '0')}`;
}

function timestamp(date) {
  return `${date}T12:00:00.000Z`;
}

const today = anchorDate;
const firstMonth = monthAt(-(HISTORY_MONTHS - 1));
const startDate = isoDate(firstMonth, 1);

/** Ciclo da fatura de uma compra; mesmas regras de `invoiceCycleFor` (dias até 28). */
function invoiceFor(card, date) {
  const [year, month, day] = date.split('-').map(Number);
  let closing = { year, month };
  if (day >= card.closingDay) {
    closing = monthAfter(closing, 1);
  }
  const due = card.dueDay > card.closingDay ? closing : monthAfter(closing, 1);
  return {
    referenceMonth: isoMonth(due),
    closingDate: isoDate(closing, card.closingDay),
    dueDate: isoDate(due, card.dueDay),
  };
}

function monthAfter({ year, month }, count) {
  const total = year * 12 + month - 1 + count;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

// ---------------------------------------------------------------------------------------------
// Usuário

const userId = faker.string.uuid();
const salt = Buffer.from(faker.helpers.multiple(() => faker.number.int(255), { count: 16 }));
const user = {
  id: userId,
  name: faker.person.fullName(),
  email: DEMO_CREDENTIALS.email,
  passwordHash: {
    algorithm: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: salt.toString('base64'),
    hash: pbkdf2Sync(DEMO_CREDENTIALS.password, salt, PBKDF2_ITERATIONS, 32, 'sha256').toString(
      'base64',
    ),
  },
  createdAt: timestamp(startDate),
};

const base = () => ({ id: faker.string.uuid(), userId, createdAt: timestamp(startDate) });

// ---------------------------------------------------------------------------------------------
// Contas

const bankName = `Banco ${faker.location.city()}`;
const account = (name, type, institution, initialBalance, color, icon) => ({
  ...base(),
  name,
  type,
  institution,
  initialBalance,
  color,
  icon,
  isArchived: false,
});

const checking = account(
  'Conta corrente',
  'checking',
  bankName,
  250_000,
  '#1565c0',
  'account_balance',
);
const savings = account('Poupança', 'savings', bankName, 800_000, '#2e7d32', 'savings');
const wallet = account('Carteira', 'cash', null, 15_000, '#ef6c00', 'payments');
const investments = account(
  'Investimentos',
  'investment',
  `${faker.company.name()} Investimentos`,
  1_500_000,
  '#00838f',
  'trending_up',
);
const accounts = [checking, savings, wallet, investments];

// ---------------------------------------------------------------------------------------------
// Categorias: o mesmo conjunto padrão criado pelo app no primeiro acesso

const categories = DEFAULT_CATEGORIES.map((category) => ({
  ...base(),
  ...category,
  isDefault: true,
  isArchived: false,
}));
const category = (name) => categories.find((item) => item.name === name).id;

// ---------------------------------------------------------------------------------------------
// Cartões

const card = (name, brand, creditLimit, closingDay, dueDay, color) => ({
  ...base(),
  name,
  brand,
  lastFourDigits: faker.string.numeric(4),
  creditLimit,
  closingDay,
  dueDay,
  paymentAccountId: checking.id,
  color,
  isArchived: false,
});

const mainCard = card('Cartão principal', 'mastercard', 800_000, 3, 10, '#6a1b9a');
const travelCard = card('Cartão viagens', 'visa', 500_000, 20, 27, '#546e7a');
const creditCards = [mainCard, travelCard];

// ---------------------------------------------------------------------------------------------
// Transações

const transactions = [];

function transaction(fields) {
  transactions.push({
    ...base(),
    accountId: null,
    creditCardId: null,
    invoiceMonth: null,
    destinationAccountId: null,
    categoryId: null,
    status: 'completed',
    notes: null,
    ...fields,
    createdAt: timestamp(fields.date),
  });
}

const money = (min, max) => faker.number.int({ min, max }) * 100 + faker.number.int(99);

/** Lançamento fixo do mês: depois de hoje, fica pendente (previsto). */
function scheduled(month, day, fields) {
  const date = isoDate(month, day);
  if (date > today && fields.creditCardId) {
    return; // compras no cartão são sempre realizadas: não há compras futuras.
  }
  transaction({ ...fields, date, status: date > today ? 'pending' : 'completed' });
}

/** Lançamentos variáveis do mês, só até hoje (no mês atual, proporcionais aos dias passados). */
function random(month, count, build) {
  const lastDay = isoMonth(month) === isoMonth(monthAt(0)) ? Math.min(anchorDay, 28) : 28;
  const total = Math.ceil((count * lastDay) / 28);
  for (let i = 0; i < total; i++) {
    transaction({ ...build(), date: isoDate(month, faker.number.int({ min: 1, max: lastDay })) });
  }
}

const groceries = ['Supermercado', 'Feira', 'Padaria', 'Hortifrúti', 'Açougue'];
const meals = ['Restaurante', 'Lanchonete', 'Delivery', 'Cafeteria'];
const transport = ['Combustível', 'Aplicativo de transporte', 'Estacionamento', 'Pedágio'];
const leisure = ['Cinema', 'Streaming', 'Show', 'Livraria', 'Parque'];
const shopping = ['Roupas', 'Eletrônicos', 'Presente', 'Casa e decoração'];
const health = ['Farmácia', 'Consulta', 'Exames'];

const expense = (name, description, amount, source) => ({
  type: 'expense',
  description,
  amount,
  categoryId: category(name),
  ...source,
});

for (let offset = -(HISTORY_MONTHS - 1); offset <= 0; offset++) {
  const month = monthAt(offset);
  const fromChecking = { accountId: checking.id };
  const onMainCard = { creditCardId: mainCard.id };

  scheduled(month, 5, {
    type: 'income',
    description: 'Salário',
    amount: 650_000,
    categoryId: category('Salário'),
    ...fromChecking,
  });
  scheduled(month, 6, {
    type: 'transfer',
    description: 'Reserva mensal',
    amount: 50_000,
    destinationAccountId: savings.id,
    ...fromChecking,
  });
  scheduled(month, 10, expense('Moradia', 'Aluguel', 180_000, fromChecking));
  scheduled(
    month,
    12,
    expense('Contas e serviços', 'Energia elétrica', money(140, 220), fromChecking),
  );
  scheduled(month, 15, expense('Contas e serviços', 'Internet', 11_990, fromChecking));
  scheduled(month, 18, expense('Educação', 'Curso de idiomas', 39_000, fromChecking));
  scheduled(month, 20, expense('Lazer', 'Streaming', 5_590, onMainCard));
  scheduled(month, 25, {
    type: 'income',
    description: 'Rendimento',
    amount: money(80, 140),
    categoryId: category('Investimentos'),
    accountId: investments.id,
  });

  random(month, faker.number.int({ min: 5, max: 7 }), () =>
    expense('Alimentação', faker.helpers.arrayElement(groceries), money(80, 450), onMainCard),
  );
  random(month, faker.number.int({ min: 3, max: 5 }), () =>
    expense('Alimentação', faker.helpers.arrayElement(meals), money(25, 120), {
      accountId: faker.helpers.arrayElement([checking.id, wallet.id]),
    }),
  );
  random(month, faker.number.int({ min: 3, max: 5 }), () =>
    expense('Transporte', faker.helpers.arrayElement(transport), money(20, 250), onMainCard),
  );
  random(month, faker.number.int({ min: 1, max: 3 }), () =>
    expense('Lazer', faker.helpers.arrayElement(leisure), money(30, 200), {
      creditCardId: travelCard.id,
    }),
  );
  random(month, faker.number.int({ min: 1, max: 2 }), () =>
    expense('Compras', faker.helpers.arrayElement(shopping), money(60, 600), {
      creditCardId: faker.helpers.arrayElement([mainCard.id, travelCard.id]),
    }),
  );
  random(month, faker.number.int({ min: 0, max: 2 }), () =>
    expense('Saúde', faker.helpers.arrayElement(health), money(30, 300), fromChecking),
  );
  if (faker.datatype.boolean()) {
    random(month, 1, () => ({
      type: 'income',
      description: `Projeto freelance — ${faker.company.name()}`,
      amount: money(800, 2500),
      categoryId: category('Freelance'),
      ...fromChecking,
    }));
  }
  random(month, 1, () => ({
    type: 'transfer',
    description: 'Saque',
    amount: faker.number.int({ min: 1, max: 4 }) * 5_000,
    accountId: checking.id,
    destinationAccountId: wallet.id,
  }));
}

// Pagamentos das faturas já vencidas; a fatura fechada mais recente fica para a demo pagar.
for (const creditCard of creditCards) {
  const totals = new Map();
  for (const purchase of transactions) {
    if (purchase.creditCardId === creditCard.id && purchase.type === 'expense') {
      const invoice = invoiceFor(creditCard, purchase.date);
      const current = totals.get(invoice.referenceMonth) ?? { invoice, total: 0 };
      current.total += purchase.amount;
      totals.set(invoice.referenceMonth, current);
    }
  }
  for (const { invoice, total } of totals.values()) {
    if (invoice.dueDate < today && invoice.dueDate >= startDate) {
      transaction({
        type: 'invoice-payment',
        description: `Fatura ${creditCard.name}`,
        amount: total,
        date: invoice.dueDate,
        accountId: creditCard.paymentAccountId,
        creditCardId: creditCard.id,
        invoiceMonth: invoice.referenceMonth,
      });
    }
  }
}

transactions.sort((a, b) => a.date.localeCompare(b.date));

// ---------------------------------------------------------------------------------------------
// Orçamentos

const budget = (name, limits, alertThreshold = 80) => ({
  ...base(),
  categoryId: category(name),
  limits,
  alertThreshold,
});
const firstMonthIso = isoMonth(firstMonth);
const budgets = [
  budget('Alimentação', [
    { month: firstMonthIso, amount: 200_000 },
    { month: isoMonth(monthAt(-2)), amount: 220_000 },
  ]),
  budget('Transporte', [{ month: firstMonthIso, amount: 60_000 }], 90),
  budget('Lazer', [{ month: firstMonthIso, amount: 25_000 }]),
  budget('Compras', [{ month: firstMonthIso, amount: 50_000 }], 75),
];

// ---------------------------------------------------------------------------------------------
// Metas

function monthlyContributions(amount, fromOffset, toOffset, day) {
  const contributions = [];
  for (let offset = fromOffset; offset <= toOffset; offset++) {
    const date = isoDate(monthAt(offset), day);
    if (date <= today) {
      contributions.push({
        id: faker.string.uuid(),
        type: 'deposit',
        amount,
        date,
        note: null,
        createdAt: timestamp(date),
      });
    }
  }
  return contributions;
}

const goal = (fields) => ({
  ...base(),
  description: null,
  isPaused: false,
  isArchived: false,
  ...fields,
});

const goals = [
  goal({
    name: 'Reserva de emergência',
    description: 'Seis meses de despesas guardados.',
    targetAmount: 3_000_000,
    initialAmount: 800_000,
    contributions: monthlyContributions(50_000, -(HISTORY_MONTHS - 1), 0, 7),
    deadline: isoDate(monthAt(18), 28),
    color: '#2e7d32',
    icon: 'health_and_safety',
  }),
  goal({
    name: 'Viagem de férias',
    targetAmount: 900_000,
    initialAmount: 100_000,
    contributions: [
      ...monthlyContributions(100_000, -4, 0, 8),
      {
        id: faker.string.uuid(),
        type: 'withdrawal',
        amount: 40_000,
        date: isoDate(monthAt(-2), 20),
        note: 'Reserva das passagens',
        createdAt: timestamp(isoDate(monthAt(-2), 20)),
      },
    ],
    deadline: isoDate(monthAt(4), 28),
    color: '#1565c0',
    icon: 'flight',
  }),
  goal({
    name: 'Notebook novo',
    targetAmount: 600_000,
    initialAmount: 150_000,
    contributions: monthlyContributions(30_000, -5, -3, 9),
    deadline: null,
    color: '#546e7a',
    icon: 'devices',
    isPaused: true,
  }),
  goal({
    name: 'Curso de especialização',
    targetAmount: 450_000,
    initialAmount: 0,
    contributions: monthlyContributions(90_000, -5, -1, 9),
    deadline: isoDate(monthAt(-1), 28),
    color: '#6a1b9a',
    icon: 'school',
  }),
];

// ---------------------------------------------------------------------------------------------

const seed = {
  meta: { anchorDate },
  users: [user],
  accounts,
  transactions,
  categories,
  budgets,
  creditCards,
  goals,
};

writeFileSync(new URL('../db/db.seed.json', import.meta.url), `${JSON.stringify(seed, null, 2)}\n`);
console.log(
  `db/db.seed.json gerado (referência ${anchorDate}): ${transactions.length} transações, ` +
    `${accounts.length} contas, ${creditCards.length} cartões, ${goals.length} metas.`,
);
