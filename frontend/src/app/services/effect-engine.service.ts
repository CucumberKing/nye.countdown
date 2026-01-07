import { Injectable, signal } from '@angular/core';
import { Application, Container } from 'pixi.js';
import { Effect, EffectConfig } from '../effects/base-effect';
import { FireworkEffect } from '../effects/firework.effect';
import { DiscoEffect } from '../effects/disco.effect';
import { EmojiBurstEffect } from '../effects/emoji-burst.effect';

/**
 * Effect Engine Service
 *
 * Manages a PixiJS application for rendering GPU-accelerated visual effects.
 * Provides a unified interface for triggering different effect types based on emoji.
 */

// Emoji to effect type mapping
const FIREWORK_EMOJIS = ['🎆', '🎇'];
const DISCO_EMOJIS = ['🪩'];

@Injectable({
  providedIn: 'root',
})
export class EffectEngineService {
  private app: Application | null = null;
  private effects_container: Container | null = null;
  private active_effects: Effect[] = [];
  private _initialized = signal(false);

  readonly initialized = this._initialized.asReadonly();

  /**
   * Initialize the PixiJS application and attach to container.
   */
  async init(container_el: HTMLElement): Promise<void> {
    if (this.app) {
      console.warn('EffectEngine already initialized');
      return;
    }

    this.app = new Application();

    await this.app.init({
      backgroundAlpha: 0, // Transparent background
      resizeTo: container_el,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    // Style the canvas
    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    `;

    container_el.appendChild(canvas);

    // Create effects container
    this.effects_container = new Container();
    this.app.stage.addChild(this.effects_container);

    // Start render loop
    this.app.ticker.add((ticker) => {
      this.update(ticker.deltaMS);
    });

    // Handle resize
    window.addEventListener('resize', () => this.handle_resize());

    this._initialized.set(true);
  }

  /**
   * Trigger an effect for the given emoji at a random horizontal position.
   */
  trigger(emoji: string): void {
    if (!this.app || !this.effects_container) {
      console.warn('EffectEngine not initialized');
      return;
    }

    const x = 0.15 + Math.random() * 0.7; // 15% to 85%
    const y = 1.0; // Start from bottom

    const config: EffectConfig = {
      x,
      y,
      width: this.app.screen.width,
      height: this.app.screen.height,
    };

    let effect: Effect;

    if (FIREWORK_EMOJIS.includes(emoji)) {
      effect = new FireworkEffect();
    } else if (DISCO_EMOJIS.includes(emoji)) {
      effect = new DiscoEffect();
    } else {
      effect = new EmojiBurstEffect(emoji);
    }

    effect.spawn(config);
    this.effects_container.addChild(effect.container);
    this.active_effects.push(effect);
  }

  /**
   * Update all active effects and clean up completed ones.
   */
  private update(delta_ms: number): void {
    const still_active: Effect[] = [];

    for (const effect of this.active_effects) {
      effect.update(delta_ms);

      if (effect.is_complete()) {
        effect.destroy();
        if (this.effects_container) {
          this.effects_container.removeChild(effect.container);
        }
      } else {
        still_active.push(effect);
      }
    }

    this.active_effects = still_active;
  }

  /**
   * Handle window resize.
   */
  private handle_resize(): void {
    if (this.app) {
      this.app.resize();
    }
  }

  /**
   * Clean up the engine.
   */
  destroy(): void {
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
      this.effects_container = null;
      this.active_effects = [];
      this._initialized.set(false);
    }
  }
}

