import {
  Component,
  Input,
  signal,
  effect,
  ElementRef,
  ViewChild,
  AfterViewInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import QRCode from 'qrcode';
import { environment } from '../../../environments/environment';

/**
 * QR Code Component
 *
 * Renders a QR code that links to the remote control view.
 * Clickable on desktop to open the remote in a new tab.
 */
@Component({
  selector: 'app-qr-code',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="qr-container" (click)="open_remote()" [title]="tooltip">
      <canvas #qr_canvas class="qr-canvas"></canvas>
      <div class="qr-label">SCAN TO INTERACT</div>
    </div>
  `,
  styles: `
    .qr-container {
      position: fixed;
      bottom: 80px;
      right: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      z-index: 100;
      padding: 12px;
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      backdrop-filter: blur(10px);
      transition: all 0.3s ease;

      &:hover {
        background: rgba(0, 0, 0, 0.8);
        border-color: var(--neon-cyan, #00f5ff);
        box-shadow: 0 0 20px rgba(0, 245, 255, 0.3);
        transform: scale(1.05);
      }
    }

    .qr-canvas {
      width: 100px !important;
      height: 100px !important;
      border-radius: 8px;
    }

    .qr-label {
      font-family: 'Orbitron', sans-serif;
      font-size: 0.6rem;
      color: rgba(255, 255, 255, 0.6);
      letter-spacing: 0.1em;
      text-align: center;
    }

    @media (max-width: 768px) {
      .qr-container {
        bottom: 70px;
        right: 10px;
        padding: 8px;
      }

      .qr-canvas {
        width: 70px !important;
        height: 70px !important;
      }

      .qr-label {
        font-size: 0.5rem;
      }
    }
  `,
})
export class QrCodeComponent implements AfterViewInit {
  @ViewChild('qr_canvas') canvas_ref!: ElementRef<HTMLCanvasElement>;
  @Input() route: string = '/remote';

  readonly remote_url = signal<string>('');
  readonly tooltip = 'Click to open remote control';

  constructor() {
    // Generate the URL
    const base = environment.base_url || window.location.origin;
    this.remote_url.set(`${base}/#${this.route}`);
  }

  ngAfterViewInit(): void {
    this.generate_qr_code();
  }

  private async generate_qr_code(): Promise<void> {
    if (!this.canvas_ref) return;

    const url = this.remote_url();

    try {
      await QRCode.toCanvas(this.canvas_ref.nativeElement, url, {
        width: 100,
        margin: 1,
        color: {
          dark: '#ffffff',
          light: '#00000000', // Transparent background
        },
        errorCorrectionLevel: 'M',
      });
    } catch (err) {
      console.error('Failed to generate QR code:', err);
    }
  }

  open_remote(): void {
    window.open(this.remote_url(), '_blank');
  }
}

