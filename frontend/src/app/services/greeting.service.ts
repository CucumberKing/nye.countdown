import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { WebSocketService } from './websocket.service';
import { AnalyticsService } from './analytics.service';

/**
 * Greeting Service
 *
 * Handles sending and receiving location-based greetings via WebSocket.
 * Uses browser geolocation to determine user's location.
 */

export interface GreetingBroadcast {
  text: string;
  location: string;
  ts: number;
}

export interface GreetingSendResult {
  success: boolean;
  location: string;
}

// Greeting template indices
export const GREETING_TEMPLATES = [
  'Happy New Year from {location}!',
  'Cheers from {location}!',
  '{location} says Happy New Year!',
] as const;

@Injectable({
  providedIn: 'root',
})
export class GreetingService {
  private readonly ws = inject(WebSocketService);
  private readonly analytics = inject(AnalyticsService);

  // Track last sent time to prevent spam
  private last_sent_ts = 0;
  private readonly MIN_SEND_INTERVAL_MS = 5000; // 5 seconds between greetings

  // Signals for state
  private readonly _is_sending = signal(false);
  private readonly _is_locating = signal(false);
  private readonly _last_location = signal<string | null>(null);
  private readonly _geolocation_error = signal<string | null>(null);

  readonly is_sending = this._is_sending.asReadonly();
  readonly is_locating = this._is_locating.asReadonly();
  readonly last_location = this._last_location.asReadonly();
  readonly geolocation_error = this._geolocation_error.asReadonly();

  /**
   * Observable stream of incoming greetings from all clients.
   */
  readonly greetings$: Observable<GreetingBroadcast> =
    this.ws.on_notification<GreetingBroadcast>('greeting.broadcast');

  /**
   * Check if geolocation is available.
   */
  get is_geolocation_available(): boolean {
    return 'geolocation' in navigator;
  }

  /**
   * Send a greeting with the user's current location.
   * Will request geolocation permission if not already granted.
   */
  async send_greeting(template_index: number = 0): Promise<boolean> {
    // Rate limiting
    const now = Date.now();
    if (now - this.last_sent_ts < this.MIN_SEND_INTERVAL_MS) {
      console.warn('Greeting rate limited');
      return false;
    }

    if (!this.ws.is_connected()) {
      this._geolocation_error.set('Not connected to server');
      return false;
    }

    if (!this.is_geolocation_available) {
      this._geolocation_error.set('Geolocation not available');
      return false;
    }

    this._is_locating.set(true);
    this._geolocation_error.set(null);

    try {
      // Get current position
      const position = await this.get_current_position();

      this._is_locating.set(false);
      this._is_sending.set(true);
      this.last_sent_ts = now;

      // Send to backend
      const result = await this.ws.call<GreetingSendResult>('greeting.send', {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        template: template_index,
      });

      if (result.success) {
        this._last_location.set(result.location);
        this.analytics.track_greeting(result.location);
        return true;
      }

      return false;
    } catch (e) {
      const error_message = e instanceof GeolocationPositionError ? this.get_geo_error_message(e) : String(e);

      this._geolocation_error.set(error_message);
      console.error('Failed to send greeting:', e);
      return false;
    } finally {
      this._is_locating.set(false);
      this._is_sending.set(false);
    }
  }

  /**
   * Get current position as a promise.
   */
  private get_current_position(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000, // Cache for 1 minute
      });
    });
  }

  /**
   * Convert GeolocationPositionError to user-friendly message.
   */
  private get_geo_error_message(error: GeolocationPositionError): string {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Location permission denied';
      case error.POSITION_UNAVAILABLE:
        return 'Location unavailable';
      case error.TIMEOUT:
        return 'Location request timed out';
      default:
        return 'Location error';
    }
  }
}

