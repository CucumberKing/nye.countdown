import { Injectable, signal, computed } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Configuration Service
 *
 * Fetches static configuration from the backend once on startup.
 * Provides target timestamp and optional legal links.
 */

interface AppConfig {
  target_ts: number; // Unix seconds
  impressum_url: string | null;
  privacy_url: string | null;
  frontend_url: string;
}

// Default target: January 1, 2027 00:00:00 UTC in milliseconds
const DEFAULT_TARGET_TS_MS = 1798761600 * 1000;

// Default frontend URL (will be overwritten by backend config)
const DEFAULT_FRONTEND_URL = 'http://localhost:4200';

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  // Private signals
  private readonly _target_ts_ms = signal<number>(DEFAULT_TARGET_TS_MS);
  private readonly _impressum_url = signal<string | null>(null);
  private readonly _privacy_url = signal<string | null>(null);
  private readonly _frontend_url = signal<string>(DEFAULT_FRONTEND_URL);
  private readonly _is_loaded = signal<boolean>(false);

  // Public readonly signals
  readonly target_ts_ms = this._target_ts_ms.asReadonly();
  readonly impressum_url = this._impressum_url.asReadonly();
  readonly privacy_url = this._privacy_url.asReadonly();
  readonly frontend_url = this._frontend_url.asReadonly();
  readonly is_loaded = this._is_loaded.asReadonly();

  // Computed: target year derived from timestamp
  readonly target_year = computed(() =>
    new Date(this._target_ts_ms()).getFullYear()
  );

  constructor() {
    this.fetch_config();
  }

  private async fetch_config(): Promise<void> {
    try {
      const response = await fetch(`${environment.api_url}/config`);
      if (!response.ok) {
        throw new Error(`Config fetch failed: ${response.status}`);
      }

      const config: AppConfig = await response.json();

      // Update signals (convert target_ts from seconds to ms)
      this._target_ts_ms.set(config.target_ts * 1000);
      this._impressum_url.set(config.impressum_url);
      this._privacy_url.set(config.privacy_url);
      this._frontend_url.set(config.frontend_url);
      this._is_loaded.set(true);

      console.log('⚙️ Config loaded:', {
        target_year: this.target_year(),
        frontend_url: config.frontend_url,
      });
    } catch (error) {
      console.error('Failed to fetch config, using defaults:', error);
      // Keep defaults, mark as loaded anyway
      this._is_loaded.set(true);
    }
  }
}

