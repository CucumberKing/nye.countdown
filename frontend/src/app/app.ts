import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AnalyticsService } from './services/analytics.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  styles: `
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
    }
  `,
})
export class App {
  private readonly analytics = inject(AnalyticsService);

  constructor() {
    this.analytics.init();
  }
}
