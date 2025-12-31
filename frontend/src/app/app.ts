import { Component } from '@angular/core';
import { CountdownComponent } from './components/countdown/countdown';

@Component({
  selector: 'app-root',
  imports: [CountdownComponent],
  template: '<app-countdown />',
  styles: `
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
    }
  `,
})
export class App {}
