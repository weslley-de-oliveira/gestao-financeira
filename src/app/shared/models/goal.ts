import { Cents } from '../utils/money';
import { IsoDate } from '../utils/date';
import { AppearanceOption } from './appearance';

export const GOAL_NAME_MAX_LENGTH = 60;
export const GOAL_DESCRIPTION_MAX_LENGTH = 300;
export const CONTRIBUTION_NOTE_MAX_LENGTH = 120;

export type ContributionType = 'deposit' | 'withdrawal';

export const CONTRIBUTION_TYPE_LABELS: Readonly<Record<ContributionType, string>> = {
  deposit: 'Aporte',
  withdrawal: 'Retirada',
};

/**
 * Movimentação manual de uma meta. Não está ligada a contas nem transações: a integração com
 * transações fica para uma etapa posterior.
 */
export interface GoalContribution {
  id: string;
  type: ContributionType;
  /** Sempre positivo; o tipo define se soma ou subtrai. */
  amount: Cents;
  date: IsoDate;
  note: string | null;
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  targetAmount: Cents;
  /** Valor já guardado quando a meta foi criada. */
  initialAmount: Cents;
  /** Aportes e retiradas, em qualquer ordem; a exibição ordena por data. */
  contributions: GoalContribution[];
  deadline: IsoDate | null;
  /** Cor de identificação, uma das `APPEARANCE_COLORS`. */
  color: string;
  /** Ícone do Material Symbols, um dos `GOAL_ICONS`. */
  icon: string;
  /** Pausada pela pessoa: não fica atrasada enquanto pausada. */
  isPaused: boolean;
  isArchived: boolean;
  createdAt: string;
}

/** Status calculado: concluída > pausada > atrasada > em andamento. */
export type GoalStatus = 'in-progress' | 'completed' | 'paused' | 'overdue';

export const GOAL_STATUS_LABELS: Readonly<Record<GoalStatus, string>> = {
  'in-progress': 'Em andamento',
  completed: 'Concluída',
  paused: 'Pausada',
  overdue: 'Atrasada',
};

/** Ícone de cada status, exibido junto ao texto (o status nunca é indicado só por cor). */
export const GOAL_STATUS_ICONS: Readonly<Record<GoalStatus, string>> = {
  'in-progress': 'trending_up',
  completed: 'check_circle',
  paused: 'pause_circle',
  overdue: 'schedule',
};

/** Meta com o progresso calculado (não persistido). */
export interface GoalWithProgress extends Goal {
  /** Inicial + aportes − retiradas. */
  currentAmount: Cents;
  /** Quanto falta para o alvo; zero quando atingido. */
  remainingAmount: Cents;
  /** Quanto passou do alvo; zero enquanto não atingido. */
  excessAmount: Cents;
  /** Percentual atingido, sem limite superior. */
  percent: number;
  status: GoalStatus;
  /** Meses até o prazo, contando o atual; `null` sem prazo, concluída ou com prazo vencido. */
  monthsLeft: number | null;
  /** Aporte mensal necessário para atingir o alvo no prazo; mesmo critério de `monthsLeft`. */
  monthlyPace: Cents | null;
}

export const GOAL_ICONS: readonly AppearanceOption[] = [
  { value: 'savings', label: 'Cofrinho' },
  { value: 'flight', label: 'Viagem' },
  { value: 'home', label: 'Casa' },
  { value: 'directions_car', label: 'Carro' },
  { value: 'school', label: 'Estudos' },
  { value: 'health_and_safety', label: 'Reserva de emergência' },
  { value: 'devices', label: 'Eletrônicos' },
  { value: 'celebration', label: 'Celebração' },
];
