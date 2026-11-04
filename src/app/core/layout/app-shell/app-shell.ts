import { Component, viewChild } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { APP_NAME } from '../app-title-strategy';
import { injectIsMobile } from '../breakpoints';
import { NAVIGATION_GROUPS } from '../navigation';
import { Topbar } from '../topbar/topbar';

/** Layout das áreas autenticadas: sidebar (sobreposta no mobile), topbar e conteúdo da rota. */
@Component({
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIcon,
    MatListModule,
    MatSidenavModule,
    Topbar,
  ],
  selector: 'app-shell',
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
})
export class AppShell {
  private readonly sidenav = viewChild.required(MatSidenav);

  protected readonly appName = APP_NAME;
  protected readonly navigationGroups = NAVIGATION_GROUPS;
  protected readonly isMobile = injectIsMobile();

  protected toggleSidenav(): void {
    void this.sidenav().toggle();
  }

  protected closeSidenavOnMobile(): void {
    if (this.isMobile()) {
      void this.sidenav().close();
    }
  }
}
