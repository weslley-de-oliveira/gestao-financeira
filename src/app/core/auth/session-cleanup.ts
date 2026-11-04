import { Injectable } from '@angular/core';

/**
 * Limpeza do estado em memória ao encerrar a sessão. Cada facade registra como zerar seus dados,
 * para que a próxima pessoa a entrar neste navegador não veja, nem por um instante, os dados da
 * anterior.
 */
@Injectable({ providedIn: 'root' })
export class SessionCleanup {
  private readonly tasks = new Set<() => void>();

  register(task: () => void): void {
    this.tasks.add(task);
  }

  run(): void {
    for (const task of this.tasks) {
      task();
    }
  }
}
