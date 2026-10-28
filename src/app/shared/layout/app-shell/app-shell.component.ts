import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '@shared/layout/header/header.component';
import { BottomNavComponent } from '@shared/layout/bottom-nav/bottom-nav.component';
import { OfflineBannerComponent } from '@shared/ui/offline-banner/offline-banner.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, HeaderComponent, BottomNavComponent, OfflineBannerComponent],
  template: `
    <app-header />
    <app-offline-banner />
    <main>
      <router-outlet />
    </main>
    <app-bottom-nav />
  `,
})
export class AppShellComponent {}
