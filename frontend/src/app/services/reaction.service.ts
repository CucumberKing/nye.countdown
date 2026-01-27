import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { WebSocketService } from './websocket.service';
import { AnalyticsService } from './analytics.service';

/**
 * Reaction Service
 *
 * Handles sending and receiving emoji reactions via WebSocket.
 * Reactions are broadcast to all connected clients.
 */

export interface ReactionBroadcast {
  emoji: string;
  from_location: string | null;
  ts: number;
}

// Allowed party emojis
export const ALLOWED_EMOJIS = [
  '🎉',
  '🎊',
  '🥳',
  '🍾',
  '🥂',
  '✨',
  '🎆',
  '🎇',
  '💃',
  '🕺',
  '🪩',
  '❤️',
] as const;

export type PartyEmoji = (typeof ALLOWED_EMOJIS)[number];

@Injectable({
  providedIn: 'root',
})
export class ReactionService {
  private readonly ws = inject(WebSocketService);
  private readonly analytics = inject(AnalyticsService);

  // Track last sent time to prevent spam
  private last_sent_ts = 0;
  private readonly MIN_SEND_INTERVAL_MS = 200;

  // Signal for pending state
  private readonly _is_sending = signal(false);
  readonly is_sending = this._is_sending.asReadonly();

  /**
   * Observable stream of incoming reactions from all clients.
   */
  readonly reactions$: Observable<ReactionBroadcast> =
    this.ws.on_notification<ReactionBroadcast>('reaction.broadcast');

  /**
   * Send an emoji reaction.
   * Returns true if sent successfully, false if rate limited or error.
   */
  async send_reaction(emoji: PartyEmoji): Promise<boolean> {
    // Rate limiting
    const now = Date.now();
    if (now - this.last_sent_ts < this.MIN_SEND_INTERVAL_MS) {
      return false;
    }

    if (!this.ws.is_connected()) {
      return false;
    }

    // Validate emoji
    if (!ALLOWED_EMOJIS.includes(emoji)) {
      console.warn('Invalid emoji:', emoji);
      return false;
    }

    this._is_sending.set(true);
    this.last_sent_ts = now;

    try {
      await this.ws.call('reaction.send', { emoji });
      this.analytics.track_reaction(emoji);
      return true;
    } catch (e) {
      console.error('Failed to send reaction:', e);
      return false;
    } finally {
      this._is_sending.set(false);
    }
  }

  /**
   * Check if an emoji is in the allowed set.
   */
  is_valid_emoji(emoji: string): emoji is PartyEmoji {
    return ALLOWED_EMOJIS.includes(emoji as PartyEmoji);
  }
}

