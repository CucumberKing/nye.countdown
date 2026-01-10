import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { TimeSyncService } from '../../services/time-sync.service';
import { ConfigService } from '../../services/config.service';
import { QrCodeComponent } from '../qr-code/qr-code';
import { ReactionOverlayComponent } from '../reaction-overlay/reaction-overlay';

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total_ms: number;
}

@Component({
  selector: 'app-countdown',
  standalone: true,
  imports: [QrCodeComponent, ReactionOverlayComponent],
  templateUrl: './countdown.html',
  styleUrl: './countdown.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountdownComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly time_sync = inject(TimeSyncService);
  private readonly config = inject(ConfigService);
  private interval_id: ReturnType<typeof setInterval> | null = null;
  private confetti_interval: ReturnType<typeof setInterval> | null = null;
  private firework_interval: ReturnType<typeof setInterval> | null = null;
  private emoji_interval: ReturnType<typeof setInterval> | null = null;
  private wake_lock: WakeLockSentinel | null = null;

  @ViewChild('stars_container') stars_container!: ElementRef<HTMLDivElement>;
  @ViewChild('confetti_container') confetti_container!: ElementRef<HTMLDivElement>;

  // State signals
  readonly is_celebrating = signal(false);
  readonly is_simulating = signal(false);
  private simulation_start_ts = 0;
  private readonly SIMULATION_DURATION_MS = 65000; // 65 seconds

  readonly time_remaining = signal<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    total_ms: 0,
  });

  // Computed values for template
  readonly days_display = computed(() =>
    String(this.time_remaining().days).padStart(2, '0')
  );
  readonly hours_display = computed(() =>
    String(this.time_remaining().hours).padStart(2, '0')
  );
  readonly minutes_display = computed(() =>
    String(this.time_remaining().minutes).padStart(2, '0')
  );
  readonly seconds_display = computed(() =>
    String(this.time_remaining().seconds).padStart(2, '0')
  );

  readonly is_final_minute = computed(() => this.time_remaining().total_ms < 60000);
  readonly is_last_ten = computed(() => this.time_remaining().total_ms < 10000);

  // Config from backend
  readonly target_year = this.config.target_year;
  readonly imprint_url = this.config.imprint_url;
  readonly privacy_url = this.config.privacy_url;

  readonly sync_status = this.time_sync.sync_status;

  // Confetti colors
  private readonly confetti_colors = [
    '#ff2d95', '#00f5ff', '#ffff00', '#39ff14', '#bf00ff',
    '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff',
  ];

  private readonly celebration_emojis = [
    '🎉', '🎊', '🥳', '🍾', '🥂', '✨', '🌟', '💫', '🎆', '🎇', '🪩', '💃', '🕺', '🎵', '🎶',
  ];

  ngOnInit(): void {
    this.update_countdown();
    this.interval_id = setInterval(() => this.update_countdown(), 100);
    this.request_wake_lock();

    // Re-acquire wake lock on visibility change
    document.addEventListener('visibilitychange', this.on_visibility_change);
  }

  ngAfterViewInit(): void {
    this.create_stars();
  }

  ngOnDestroy(): void {
    if (this.interval_id) {
      clearInterval(this.interval_id);
    }
    this.stop_celebration_effects();
    document.removeEventListener('visibilitychange', this.on_visibility_change);
  }

  private on_visibility_change = (): void => {
    if (document.visibilityState === 'visible' && !this.wake_lock) {
      this.request_wake_lock();
    }
  };

  private async request_wake_lock(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this.wake_lock = await navigator.wakeLock.request('screen');
        console.log('🔆 Screen wake lock active - party mode!');
      }
    } catch (err) {
      console.log('Wake lock not available');
    }
  }

  private update_countdown(): void {
    if (this.is_celebrating()) return;

    let diff: number;

    if (this.is_simulating()) {
      // Simulation mode: countdown from 65 seconds
      const elapsed = Date.now() - this.simulation_start_ts;
      diff = this.SIMULATION_DURATION_MS - elapsed;

      if (diff <= 0) {
        this.is_simulating.set(false);
        this.start_celebration();
        return;
      }
    } else {
      // Normal mode: countdown to target
      const now_ms = this.time_sync.get_synced_time_ms();
      const target_ts_ms = this.config.target_ts_ms();
      diff = target_ts_ms - now_ms;

      if (diff <= 0) {
        this.start_celebration();
        return;
      }
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    this.time_remaining.set({ days, hours, minutes, seconds, total_ms: diff });
  }

  private create_stars(): void {
    if (!this.stars_container) return;
    const container = this.stars_container.nativeElement;

    for (let i = 0; i < 100; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      star.style.animationDelay = `${Math.random() * 2}s`;
      star.style.animationDuration = `${1 + Math.random() * 2}s`;
      container.appendChild(star);
    }
  }

  simulate_nye(): void {
    if (this.is_celebrating() || this.is_simulating()) return;

    // Start simulation at 65 seconds
    this.is_simulating.set(true);
    this.simulation_start_ts = Date.now();
  }

  toggle_fullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  private start_celebration(): void {
    this.is_celebrating.set(true);

    // Initial confetti burst
    for (let i = 0; i < 50; i++) {
      setTimeout(() => this.create_confetti(), i * 30);
    }

    // Continuous confetti
    this.confetti_interval = setInterval(() => {
      for (let i = 0; i < 3; i++) {
        this.create_confetti();
      }
    }, 100);

    // Fireworks
    this.firework_interval = setInterval(() => {
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * (window.innerHeight * 0.6);
      this.create_firework(x, y);
    }, 500);

    // Emojis
    this.emoji_interval = setInterval(() => this.create_emoji(), 200);

    // Initial firework burst
    setTimeout(() => {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          this.create_firework(
            Math.random() * window.innerWidth,
            Math.random() * (window.innerHeight * 0.5)
          );
        }, i * 200);
      }
    }, 500);
  }

  private stop_celebration_effects(): void {
    if (this.confetti_interval) clearInterval(this.confetti_interval);
    if (this.firework_interval) clearInterval(this.firework_interval);
    if (this.emoji_interval) clearInterval(this.emoji_interval);
  }

  private create_confetti(): void {
    if (!this.confetti_container) return;
    const container = this.confetti_container.nativeElement;

    const confetti = document.createElement('div');
    confetti.className = 'confetti';

    const color = this.confetti_colors[Math.floor(Math.random() * this.confetti_colors.length)];
    const shapes = ['square', 'circle', 'triangle', 'star'];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const size = 10 + Math.random() * 15;
    const x_pos = Math.random() * 100;
    const duration = 2 + Math.random() * 3;
    const delay = Math.random() * 0.5;

    confetti.style.left = `${x_pos}%`;
    confetti.style.width = `${size}px`;
    confetti.style.height = `${size}px`;
    confetti.style.backgroundColor = color;
    confetti.style.animationDuration = `${duration}s`;
    confetti.style.animationDelay = `${delay}s`;

    if (shape === 'circle') {
      confetti.style.borderRadius = '50%';
    } else if (shape === 'triangle') {
      confetti.style.width = '0';
      confetti.style.height = '0';
      confetti.style.backgroundColor = 'transparent';
      confetti.style.borderLeft = `${size / 2}px solid transparent`;
      confetti.style.borderRight = `${size / 2}px solid transparent`;
      confetti.style.borderBottom = `${size}px solid ${color}`;
    } else if (shape === 'star') {
      confetti.style.clipPath =
        'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
    }

    container.appendChild(confetti);
    setTimeout(() => confetti.remove(), (duration + delay) * 1000);
  }

  private create_firework(x: number, y: number): void {
    if (!this.confetti_container) return;
    const container = this.confetti_container.nativeElement;

    const color = this.confetti_colors[Math.floor(Math.random() * this.confetti_colors.length)];
    const particles = 12 + Math.floor(Math.random() * 8);

    for (let i = 0; i < particles; i++) {
      const particle = document.createElement('div');
      particle.className = 'firework';
      particle.style.backgroundColor = color;
      particle.style.boxShadow = `0 0 6px ${color}, 0 0 12px ${color}`;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;

      const angle = (i / particles) * 360;
      const distance = 50 + Math.random() * 100;
      const rad = (angle * Math.PI) / 180;
      const tx = Math.cos(rad) * distance;
      const ty = Math.sin(rad) * distance;

      container.appendChild(particle);

      particle.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${tx}px, ${ty}px) scale(0.5)`, opacity: 0 },
        ],
        {
          duration: 1000 + Math.random() * 500,
          easing: 'cubic-bezier(0, 0.5, 0.5, 1)',
          fill: 'forwards',
        }
      );

      setTimeout(() => particle.remove(), 1500);
    }
  }

  private create_emoji(): void {
    if (!this.confetti_container) return;
    const container = this.confetti_container.nativeElement;

    const emoji = document.createElement('div');
    emoji.className = 'emoji';
    emoji.textContent =
      this.celebration_emojis[Math.floor(Math.random() * this.celebration_emojis.length)];
    emoji.style.left = `${Math.random() * 100}%`;
    emoji.style.bottom = '-50px';
    emoji.style.fontSize = `${1.5 + Math.random() * 2}rem`;
    emoji.style.animationDuration = `${2 + Math.random() * 2}s`;

    container.appendChild(emoji);
    setTimeout(() => emoji.remove(), 4000);
  }

  on_click(event: MouseEvent): void {
    // Create sparkles on click
    for (let i = 0; i < 8; i++) {
      const sparkle = document.createElement('div');
      sparkle.className = 'sparkle';
      sparkle.style.left = `${event.clientX}px`;
      sparkle.style.top = `${event.clientY}px`;

      const angle = (i / 8) * 360;
      const distance = 30 + Math.random() * 30;
      const rad = (angle * Math.PI) / 180;

      sparkle.innerHTML = '✦';
      sparkle.style.color = this.confetti_colors[Math.floor(Math.random() * this.confetti_colors.length)];
      sparkle.style.fontSize = '1.5rem';
      sparkle.style.textShadow = '0 0 10px currentColor';

      document.body.appendChild(sparkle);

      sparkle.animate(
        [
          { transform: 'translate(0, 0) scale(0)', opacity: 1 },
          {
            transform: `translate(${Math.cos(rad) * distance}px, ${Math.sin(rad) * distance}px) scale(1)`,
            opacity: 0,
          },
        ],
        {
          duration: 600,
          easing: 'ease-out',
          fill: 'forwards',
        }
      );

      setTimeout(() => sparkle.remove(), 600);
    }
  }
}

