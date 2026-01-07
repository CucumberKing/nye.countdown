import { Container, Text, TextStyle } from 'pixi.js';
import { Effect, EffectConfig, generate_effect_id } from './base-effect';

/**
 * Emoji Burst Effect
 *
 * An emoji rockets up from the bottom, then explodes into
 * multiple copies that scatter outward with physics.
 */

interface EmojiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotation_speed: number;
  life: number;
  max_life: number;
  text: Text;
}

type Phase = 'launch' | 'explode' | 'fade';

export class EmojiBurstEffect implements Effect {
  readonly id = generate_effect_id();
  readonly container = new Container();

  private emoji: string;
  private phase: Phase = 'launch';
  private rocket_x = 0;
  private rocket_y = 0;
  private rocket_target_y = 0;
  private rocket_text: Text | null = null;
  private particles: EmojiParticle[] = [];
  private width = 0;
  private height = 0;
  private elapsed = 0;

  private readonly ROCKET_SPEED = 0.7;
  private readonly PARTICLE_COUNT = 10;
  private readonly PARTICLE_LIFETIME = 1800;

  constructor(emoji: string) {
    this.emoji = emoji;
  }

  spawn(config: EffectConfig): void {
    this.width = config.width;
    this.height = config.height;
    this.rocket_x = config.x * config.width;
    this.rocket_y = config.height + 50;
    this.rocket_target_y = config.height * (0.3 + Math.random() * 0.2);

    // Create rocket emoji
    const style = new TextStyle({
      fontSize: 48,
      fill: 0xffffff,
    });

    this.rocket_text = new Text({ text: this.emoji, style });
    this.rocket_text.anchor.set(0.5);
    this.rocket_text.position.set(this.rocket_x, this.rocket_y);

    this.container.addChild(this.rocket_text);
  }

  update(delta_ms: number): void {
    this.elapsed += delta_ms;

    switch (this.phase) {
      case 'launch':
        this.update_launch(delta_ms);
        break;
      case 'explode':
      case 'fade':
        this.update_particles(delta_ms);
        break;
    }
  }

  private update_launch(delta_ms: number): void {
    if (!this.rocket_text) return;

    // Move up
    this.rocket_y -= this.ROCKET_SPEED * delta_ms;
    this.rocket_text.position.set(this.rocket_x, this.rocket_y);

    // Wobble and scale animation
    const wobble = Math.sin(this.elapsed * 0.02) * 0.1;
    this.rocket_text.rotation = wobble;

    const scale = 0.8 + Math.sin(this.elapsed * 0.01) * 0.2;
    this.rocket_text.scale.set(scale);

    // Check if reached target
    if (this.rocket_y <= this.rocket_target_y) {
      this.trigger_explosion();
    }
  }

  private trigger_explosion(): void {
    this.phase = 'explode';

    // Remove rocket
    if (this.rocket_text) {
      this.container.removeChild(this.rocket_text);
      this.rocket_text.destroy();
      this.rocket_text = null;
    }

    // Create explosion particles
    for (let i = 0; i < this.PARTICLE_COUNT; i++) {
      this.spawn_particle(i);
    }

    setTimeout(() => {
      this.phase = 'fade';
    }, 100);
  }

  private spawn_particle(index: number): void {
    const style = new TextStyle({
      fontSize: 36 + Math.random() * 16,
      fill: 0xffffff,
    });

    const text = new Text({ text: this.emoji, style });
    text.anchor.set(0.5);
    text.position.set(this.rocket_x, this.rocket_y);

    // Calculate explosion direction
    const angle = (index / this.PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const speed = 0.2 + Math.random() * 0.3;

    const particle: EmojiParticle = {
      x: this.rocket_x,
      y: this.rocket_y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.2, // Initial upward boost
      rotation: 0,
      rotation_speed: (Math.random() - 0.5) * 0.01,
      life: this.PARTICLE_LIFETIME * (0.7 + Math.random() * 0.6),
      max_life: this.PARTICLE_LIFETIME,
      text,
    };

    this.container.addChild(text);
    this.particles.push(particle);
  }

  private update_particles(delta_ms: number): void {
    const gravity = 0.0003;
    const friction = 0.995;

    for (const p of this.particles) {
      // Apply physics
      p.vy += gravity * delta_ms;
      p.vx *= friction;
      p.vy *= friction;

      p.x += p.vx * delta_ms;
      p.y += p.vy * delta_ms;
      p.rotation += p.rotation_speed * delta_ms;
      p.life -= delta_ms;

      // Update text
      const alpha = Math.max(0, p.life / p.max_life);
      const scale = 0.5 + alpha * 0.8;

      p.text.position.set(p.x, p.y);
      p.text.rotation = p.rotation;
      p.text.scale.set(scale);
      p.text.alpha = alpha;
    }

    // Remove dead particles
    this.particles = this.particles.filter((p) => {
      if (p.life <= 0) {
        this.container.removeChild(p.text);
        p.text.destroy();
        return false;
      }
      return true;
    });
  }

  is_complete(): boolean {
    return this.phase === 'fade' && this.particles.length === 0;
  }

  destroy(): void {
    for (const p of this.particles) {
      p.text.destroy();
    }
    if (this.rocket_text) {
      this.rocket_text.destroy();
    }
    this.container.destroy({ children: true });
  }
}

