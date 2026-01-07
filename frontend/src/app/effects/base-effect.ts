import { Container } from 'pixi.js';

/**
 * Configuration for spawning an effect.
 */
export interface EffectConfig {
  /** Normalized X position (0-1) */
  x: number;
  /** Normalized Y position (0-1) */
  y: number;
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
}

/**
 * Base interface for all visual effects.
 */
export interface Effect {
  /** Unique identifier for this effect instance */
  readonly id: string;

  /** The PixiJS container for this effect */
  readonly container: Container;

  /**
   * Initialize the effect at the given position.
   */
  spawn(config: EffectConfig): void;

  /**
   * Update the effect state.
   * @param delta_ms Time since last update in milliseconds
   */
  update(delta_ms: number): void;

  /**
   * Check if the effect has completed and can be cleaned up.
   */
  is_complete(): boolean;

  /**
   * Clean up resources when the effect is done.
   */
  destroy(): void;
}

/**
 * Generate a unique effect ID.
 */
export function generate_effect_id(): string {
  return `effect_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

