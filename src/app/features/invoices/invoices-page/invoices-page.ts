import {
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { openConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { IsoDatePipe } from '../../../shared/pipes/iso-date.pipe';
import { MoneyPipe } from '../../../shared/pipes/money.pipe';
import { AccountsFacade } from '../../accounts/accounts.facade';
import { CreditCardsFacade } from '../../credit-cards/credit-cards.facade';
import { INVOICE_STATUS_LABELS, Invoice, canPayInvoice } from '../domain/invoice-rules';
import { InvoicePaymentError, InvoicesFacade, monthLabel } from '../invoices.facade';

/** Mensagens das recusas de pagamento. */
const PAYMENT_ERRORS: Readonly<Record<string, string>> = {
  'payment-account':
    'A conta de pagamento do cartão está arquivada ou foi removida. Reative-a ou altere a conta no cadastro do cartão.',
  'not-payable': 'Esta fatura não pode ser paga agora. Atualize a página e tente novamente.',
};

/**
 * Faturas por cartão e mês de referência (`/invoices?creditCardId=…&month=yyyy-MM`). A seleção
 * fica na URL; sem ela, vale o primeiro cartão ativo e a fatura aberta hoje.
 */
@Component({
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIcon,
    MatProgressBar,
    MatSelectModule,
    IsoDatePipe,
    MoneyPipe,
  ],
  selector: 'app-invoices-page',
  templateUrl: './invoices-page.html',
  styleUrl: './invoices-page.scss',
})
export class InvoicesPage implements OnInit {
  private readonly cardsFacade = inject(CreditCardsFacade);
  private readonly accountsFacade = inject(AccountsFacade);
  private readonly invoicesFacade = inject(InvoicesFacade);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly money = new MoneyPipe();

  /** Query params da seleção. */
  readonly creditCardId = input<string>();
  readonly month = input<string>();

  protected readonly busy = signal(false);
  protected readonly status = computed(() => {
    const statuses = [
      this.cardsFacade.status(),
      // Sem cartão, não há faturas a carregar.
      this.card() ? this.invoicesFacade.status() : 'ready',
    ];
    return statuses.includes('error')
      ? 'error'
      : statuses.includes('loading')
        ? 'loading'
        : 'ready';
  });

  /** Ativos primeiro; arquivados continuam disponíveis para consultar o histórico. */
  protected readonly cardOptions = computed(() =>
    [...this.cardsFacade.cards()].sort(
      (a, b) =>
        Number(a.isArchived) - Number(b.isArchived) || a.name.localeCompare(b.name, 'pt-BR'),
    ),
  );
  protected readonly card = computed(() => {
    const options = this.cardOptions();
    return options.find((card) => card.id === this.creditCardId()) ?? options[0] ?? null;
  });
  protected readonly invoices = this.invoicesFacade.invoices;
  /** A fatura carregada, se for do cartão exibido (ao trocar de cartão, até a nova chegar). */
  protected readonly invoice = computed(() => {
    const invoice = this.invoicesFacade.invoice();
    return invoice && invoice.creditCardId === this.card()?.id ? invoice : null;
  });
  protected readonly canPay = computed(() => {
    const invoice = this.invoice();
    return !!invoice && canPayInvoice(invoice);
  });
  protected readonly paymentAccountName = computed(() => {
    const id = this.invoice()?.payment?.accountId ?? this.card()?.paymentAccountId;
    return this.accountsFacade.accounts().find((account) => account.id === id)?.name ?? '—';
  });

  protected readonly statusLabels = INVOICE_STATUS_LABELS;
  protected readonly monthLabel = monthLabel;

  constructor() {
    // Cartão ou mês escolhidos mudaram: carrega as faturas do cartão e a do mês.
    effect(() => {
      const card = this.card();
      const month = this.month();
      if (card) {
        untracked(() => void this.invoicesFacade.select(card.id, month));
      }
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    void this.cardsFacade.load();
    void this.accountsFacade.load();
    void this.invoicesFacade.refresh();
  }

  protected selectCard(creditCardId: string): void {
    void this.router.navigate([], { queryParams: { creditCardId }, replaceUrl: true });
  }

  protected selectMonth(month: string): void {
    void this.router.navigate([], {
      queryParams: { creditCardId: this.card()?.id, month },
      replaceUrl: true,
    });
  }

  protected async pay(invoice: Invoice): Promise<void> {
    const confirmed = await firstValueFrom(
      openConfirmDialog(this.dialog, {
        title: `Pagar a fatura ${monthLabel(invoice.referenceMonth)}?`,
        message: `${this.money.transform(invoice.total)} sairão hoje da conta ${this.paymentAccountName()}. O pagamento não entra como despesa: as compras já foram contadas.`,
        confirmLabel: 'Pagar',
      }),
    );
    if (confirmed) {
      await this.run(
        () => this.invoicesFacade.pay(invoice.creditCardId, invoice.referenceMonth),
        'Pagamento registrado.',
      );
    }
  }

  protected async undoPayment(invoice: Invoice): Promise<void> {
    const confirmed = await firstValueFrom(
      openConfirmDialog(this.dialog, {
        title: `Desfazer o pagamento da fatura ${monthLabel(invoice.referenceMonth)}?`,
        message: 'O valor volta para a conta e a fatura volta ao status pelas datas.',
        confirmLabel: 'Desfazer',
      }),
    );
    if (confirmed) {
      await this.run(
        () => this.invoicesFacade.undoPayment(invoice.creditCardId, invoice.referenceMonth),
        'Pagamento desfeito.',
      );
    }
  }

  private async run(action: () => Promise<unknown>, success: string): Promise<void> {
    this.busy.set(true);
    try {
      await action();
      // O uso do limite depende dos pagamentos.
      await this.cardsFacade.load();
      this.notify(success);
    } catch (error) {
      this.notify(
        (error instanceof InvoicePaymentError && PAYMENT_ERRORS[error.reason]) ||
          'Não foi possível concluir a operação. Tente novamente.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Fechar', { duration: 5000 });
  }
}
