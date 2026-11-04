import { Component } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink, MatButton],
  selector: 'app-not-found-page',
  template: `
    <main>
      <p class="code">Erro 404</p>
      <h1>Página não encontrada</h1>
      <p>O endereço acessado não existe ou foi removido.</p>
      <a matButton="filled" routerLink="/dashboard">Voltar para o dashboard</a>
    </main>
  `,
  styles: `
    main {
      display: flex;
      min-height: 100svh;
      box-sizing: border-box;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 1rem;
      text-align: center;
    }

    h1,
    p {
      margin: 0;
    }

    h1 {
      font: var(--mat-sys-headline-small);
    }

    p {
      max-width: 24rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .code {
      font: var(--mat-sys-label-large);
    }
  `,
})
export class NotFoundPage {}
