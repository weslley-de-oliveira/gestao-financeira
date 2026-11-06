import type { components } from './api-schema';

/**
 * Formatos do contrato da API, gerados do OpenAPI (`npm run api:types`). Os repositórios HTTP
 * convertem estes formatos nos modelos do app (`shared/models`).
 */
type Schemas = components['schemas'];

export type ApiUser = Schemas['User'];
export type ApiAccount = Schemas['Account'];
export type ApiCategory = Schemas['Category'];
export type ApiTransaction = Schemas['Transaction'];
export type ApiTransactionPage = Schemas['TransactionPage'];
export type ApiCreateEntry = Schemas['CreateEntryInput'];
export type ApiCreateTransfer = Schemas['CreateTransferInput'];
export type ApiCreditCard = Schemas['CreditCard'];
export type ApiInvoice = Schemas['Invoice'];
export type ApiInvoiceSummary = Schemas['InvoiceSummary'];
export type ApiBudget = Schemas['Budget'];
export type ApiGoal = Schemas['Goal'];
export type ApiGoalContribution = Schemas['GoalContribution'];
export type ApiDashboard = Schemas['Dashboard'];
export type ApiProblemDetails = Schemas['ProblemDetails'];
