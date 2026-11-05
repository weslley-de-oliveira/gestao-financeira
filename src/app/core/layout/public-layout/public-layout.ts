import { Component } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { RouterOutlet } from '@angular/router';
import { APP_NAME } from '../app-title-strategy';

/** Layout das páginas públicas (login e cadastro), sem sidebar. */
@Component({
  imports: [RouterOutlet, MatIcon],
  selector: 'app-public-layout',
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.scss',
})
export class PublicLayout {
  protected readonly appName = APP_NAME;
  protected readonly features = [
    { icon: 'insights', text: 'Dashboard com receitas, despesas e evolução do saldo' },
    { icon: 'credit_card', text: 'Cartões e faturas sem despesas duplicadas' },
    { icon: 'savings', text: 'Orçamentos por categoria e metas com ritmo mensal' },
    { icon: 'shield_lock', text: 'Sessão criptografada e senha com hash no navegador' },
  ];
}
