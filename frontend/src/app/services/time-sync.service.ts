import { Injectable, signal, computed, OnDestroy, inject, effect } from '@angular/core';
import { WebSocketService } from './websocket.service';

/**
 * Time Synchronization Service
 *
 * Maintains accurate time by syncing with the backend NTP server via WebSocket.
 * Uses JSON-RPC time.ping method for accurate round-trip timing.
 *
 * Features:
 * - Uses shared WebSocket connection via WebSocketService
 * - Proper per-message offset calculation with RTT
 * - localStorage persistence for resilience
 * - Graceful fallback to device time
 */

interface TimePongResult {
  client_time_ms: number;
  server_time_ms: number;
  ntp_synced: boolean;
}

const STORAGE_KEY = 'nye_time_offset';
const PING_INTERVAL_MS = 1000;

@Injectable({
  providedIn: 'root',
})
export class TimeSyncService implements OnDestroy {
  private readonly ws = inject(WebSocketService);
  private ping_interval: ReturnType<typeof setInterval> | null = null;

  // Signals for reactive state
  private readonly _offset_ms = signal<number>(this.load_stored_offset());
  private readonly _is_ntp_synced = signal<boolean>(false);

  // Public readonly signals
  readonly offset_ms = this._offset_ms.asReadonly();
  readonly is_ntp_synced = this._is_ntp_synced.asReadonly();

  readonly sync_status = computed(() => {
    if (this.ws.is_connected() && this._is_ntp_synced()) {
      return 'synced';
    } else if (this.ws.is_connected()) {
      return 'connected';
    } else if (this._offset_ms() !== 0) {
      return 'cached';
    }
    return 'device';
  });

  constructor() {
    // Start ping loop when connected
    effect(() => {
      if (this.ws.is_connected()) {
        this.start_ping_loop();
      } else {
        this.stop_ping_loop();
      }
    });
  }

  ngOnDestroy(): void {
    this.stop_ping_loop();
  }

  /**
   * Get current synced time in milliseconds.
   * Falls back through: WebSocket -> cached offset -> device time
   */
  get_synced_time_ms(): number {
    return Date.now() + this._offset_ms();
  }

  /**
   * Get current synced time as Date object.
   */
  get_synced_date(): Date {
    return new Date(this.get_synced_time_ms());
  }

  private start_ping_loop(): void {
    this.stop_ping_loop();

    // Send initial ping immediately
    this.send_ping();

    // Then send pings at regular intervals
    this.ping_interval = setInterval(() => {
      this.send_ping();
    }, PING_INTERVAL_MS);
  }

  private stop_ping_loop(): void {
    if (this.ping_interval) {
      clearInterval(this.ping_interval);
      this.ping_interval = null;
    }
  }

  private async send_ping(): Promise<void> {
    if (!this.ws.is_connected()) {
      return;
    }

    const request_ts = Date.now();

    try {
      const result = await this.ws.call<TimePongResult>('time.ping', {
        client_time_ms: request_ts,
      });

      const response_ts = Date.now();
      this.handle_pong_message(result, request_ts, response_ts);
    } catch (e) {
      // Ignore errors - connection might have dropped
    }
  }

  private handle_pong_message(
    message: TimePongResult,
    request_ts: number,
    response_ts: number
  ): void {
    // Calculate round-trip time
    const round_trip_ms = response_ts - request_ts;
    const estimated_latency_ms = round_trip_ms / 2;

    // Calculate offset: server_time - (client_time_at_server)
    // client_time_at_server = request_ts + latency
    const local_time_at_server = request_ts + estimated_latency_ms;
    const offset = message.server_time_ms - local_time_at_server;

    // Update state
    this._offset_ms.set(offset);
    this._is_ntp_synced.set(message.ntp_synced);

    // Persist to localStorage for resilience
    this.store_offset(offset);
  }

  private store_offset(offset: number): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(offset));
    } catch (e) {
      // localStorage might be unavailable
    }
  }

  private load_stored_offset(): number {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      // localStorage might be unavailable or corrupted
    }
    return 0;
  }
}
