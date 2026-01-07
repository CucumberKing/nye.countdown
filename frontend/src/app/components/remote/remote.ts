import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { TimeSyncService } from '../../services/time-sync.service';
import { ConfigService } from '../../services/config.service';
import { ReactionService, ALLOWED_EMOJIS, PartyEmoji } from '../../services/reaction.service';
import { GreetingService, GREETING_TEMPLATES } from '../../services/greeting.service';
import { WebSocketService } from '../../services/websocket.service';

/**
 * Remote Control Component
 *
 * Mobile-optimized view for sending emoji reactions and greetings
 * to the main countdown display.
 */

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total_ms: number;
}

@Component({
  selector: 'app-remote',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './remote.html',
  styleUrl: './remote.scss',
})
export class RemoteComponent implements OnInit, OnDestroy {
  private readonly time_sync = inject(TimeSyncService);
  private readonly config = inject(ConfigService);
  private readonly ws = inject(WebSocketService);
  readonly reaction_service = inject(ReactionService);
  readonly greeting_service = inject(GreetingService);

  private interval_id: ReturnType<typeof setInterval> | null = null;

  // Emojis grid
  readonly emojis = ALLOWED_EMOJIS;
  readonly greeting_templates = GREETING_TEMPLATES;

  // State
  readonly time_remaining = signal<TimeRemaining>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    total_ms: 0,
  });

  readonly last_sent_emoji = signal<string | null>(null);
  readonly selected_template = signal<number>(0);
  readonly show_broadcast_feedback = signal<boolean>(false);

  // Connection state
  readonly is_connected = this.ws.is_connected;
  readonly sync_status = this.time_sync.sync_status;

  // Computed displays (matching main countdown style)
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

  readonly is_celebrating = computed(() => this.time_remaining().total_ms <= 0);

  readonly target_year = this.config.target_year;

  ngOnInit(): void {
    this.update_countdown();
    this.interval_id = setInterval(() => this.update_countdown(), 1000);
  }

  ngOnDestroy(): void {
    if (this.interval_id) {
      clearInterval(this.interval_id);
    }
  }

  private update_countdown(): void {
    const now_ms = this.time_sync.get_synced_time_ms();
    const target_ts_ms = this.config.target_ts_ms();
    const diff = Math.max(0, target_ts_ms - now_ms);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    this.time_remaining.set({ days, hours, minutes, seconds, total_ms: diff });
  }

  async send_emoji(emoji: PartyEmoji): Promise<void> {
    const success = await this.reaction_service.send_reaction(emoji);
    if (success) {
      this.last_sent_emoji.set(emoji);
      this.show_broadcast_feedback.set(true);
      // Clear feedback after animation
      setTimeout(() => {
        if (this.last_sent_emoji() === emoji) {
          this.last_sent_emoji.set(null);
        }
      }, 500);
      // Hide broadcast feedback after a bit longer
      setTimeout(() => {
        this.show_broadcast_feedback.set(false);
      }, 1500);
    }
  }

  async send_greeting(): Promise<void> {
    await this.greeting_service.send_greeting(this.selected_template());
  }

  select_template(index: number): void {
    this.selected_template.set(index);
  }

  cycle_template(): void {
    const current = this.selected_template();
    this.selected_template.set((current + 1) % GREETING_TEMPLATES.length);
  }
}

