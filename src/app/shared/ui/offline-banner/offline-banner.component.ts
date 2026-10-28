import { Component, input } from '@angular/core';

@Component({
  selector: 'app-offline-banner',
  template: `
    @if (offline()) {
      <div>Показываю закешированное</div>
    }
  `,
})
export class OfflineBannerComponent {
  readonly offline = input(false);
}
