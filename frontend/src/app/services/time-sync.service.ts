import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Time Synchronization Service
 *
 * Maintains accurate time by syncing with the backend NTP server via WebSocket.
 * Uses ping/pong protocol for accurate round-trip timing.
 *
 * Features:
 * - WebSocket connection with auto-reconnect
 * - Proper per-message offset calculation with RTT
 * - localStorage persistence for resilience
 * - Graceful fallback to device time
 */

interface PongMessage {
  type: 'pong';
  client_time_ms: number;
  server_time_ms: number;
  ntp_synced: boolean;
}

const STORAGE_KEY = 'nye_time_offset';
const RECONNECT_DELAY_MS = 5000;
const PING_INTERVAL_MS = 1000;

@Injectable({
  providedIn: 'root',
})
export class TimeSyncService implements OnDestroy {
  private ws: WebSocket | null = null;
  private reconnect_timeout: ReturnType<typeof setTimeout> | null = null;
  private ping_interval: ReturnType<typeof setInterval> | null = null;

  // Signals for reactive state
  private readonly _offset_ms = signal<number>(this.load_stored_offset());
  private readonly _is_connected = signal<boolean>(false);
  private readonly _is_ntp_synced = signal<boolean>(false);

  // Public readonly signals
  readonly offset_ms = this._offset_ms.asReadonly();
  readonly is_connected = this._is_connected.asReadonly();
  readonly is_ntp_synced = this._is_ntp_synced.asReadonly();

  readonly sync_status = computed(() => {
    if (this._is_connected() && this._is_ntp_synced()) {
      return 'synced';
    } else if (this._is_connected()) {
      return 'connected';
    } else if (this._offset_ms() !== 0) {
      return 'cached';
    }
    return 'device';
  });

  constructor() {
    this.connect();
  }

  ngOnDestroy(): void {
    this.disconnect();
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

  private connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(environment.ws_url);

      this.ws.onopen = () => {
        console.log('✨ WebSocket connected to time server');
        this._is_connected.set(true);
        this.start_ping_loop();
      };

      this.ws.onmessage = (event) => {
        const response_ts = Date.now();
        try {
          const message: PongMessage = JSON.parse(event.data);
          if (message.type === 'pong') {
            this.handle_pong_message(message, response_ts);
          }
        } catch (e) {
          console.error('Failed to parse time message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this._is_connected.set(false);
        this.stop_ping_loop();
        this.schedule_reconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this._is_connected.set(false);
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      this.schedule_reconnect();
    }
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

  private send_ping(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const ping_message = {
        type: 'ping',
        client_time_ms: Date.now(),
      };
      this.ws.send(JSON.stringify(ping_message));
    }
  }

  private handle_pong_message(message: PongMessage, response_ts: number): void {
    // Calculate round-trip time using the echoed client timestamp
    const request_ts = message.client_time_ms;
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

  private schedule_reconnect(): void {
    if (this.reconnect_timeout) {
      clearTimeout(this.reconnect_timeout);
    }

    this.reconnect_timeout = setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  private disconnect(): void {
    this.stop_ping_loop();

    if (this.reconnect_timeout) {
      clearTimeout(this.reconnect_timeout);
      this.reconnect_timeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
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
