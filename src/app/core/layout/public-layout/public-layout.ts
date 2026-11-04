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
}
