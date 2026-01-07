import { Container, Graphics } from 'pixi.js';
import { Effect, EffectConfig, generate_effect_id } from './base-effect';

/**
 * Firework Effect
 *
 * A rocket launches from the bottom, trails sparks, then explodes
 * into a burst of colorful particles with gravity and fade-out.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max_life: number;
  hue: number;
  size: number;
  graphics: Graphics;
}

type Phase = 'launch' | 'explode' | 'fade';

export class FireworkEffect implements Effect {
  readonly id = generate_effect_id();
  readonly container = new Container();

  private phase: Phase = 'launch';
  private rocket_x = 0;
  private rocket_y = 0;
  private rocket_target_y = 0;
  private rocket_graphics: Graphics | null = null;
  private trail_particles: Particle[] = [];
  private explosion_particles: Particle[] = [];
  private width = 0;
  private height = 0;
  private explosion_hue = 0;
  private elapsed = 0;

  // Timing constants
  private readonly ROCKET_SPEED = 0.8; // pixels per ms
  private readonly EXPLOSION_PARTICLE_COUNT = 80;
  private readonly PARTICLE_LIFETIME = 2000; // ms
  private readonly TRAIL_SPAWN_INTERVAL = 30; // ms
  private last_trail_spawn = 0;

  spawn(config: EffectConfig): void {
    this.width = config.width;
    this.height = config.height;
    this.rocket_x = config.x * config.width;
    this.rocket_y = config.height + 20;
    this.rocket_target_y = config.height * (0.25 + Math.random() * 0.2);
    this.explosion_hue = Math.random() * 360;

    // Create rocket
    this.rocket_graphics = new Graphics();
    this.draw_rocket();
    this.container.addChild(this.rocket_graphics);
  }

  private draw_rocket(): void {
    if (!this.rocket_graphics) return;

    this.rocket_graphics.clear();

    // Rocket body (bright core)
    this.rocket_graphics.circle(this.rocket_x, this.rocket_y, 6);
    this.rocket_graphics.fill({ color: 0xffff00 });

    // Glow effect
    this.rocket_graphics.circle(this.rocket_x, this.rocket_y, 12);
    this.rocket_graphics.fill({ color: 0xff8800, alpha: 0.4 });

    // Tail flame
    this.rocket_graphics.circle(this.rocket_x, this.rocket_y + 15, 4);
    this.rocket_graphics.fill({ color: 0xff4400, alpha: 0.6 });
  }

  update(delta_ms: number): void {
    this.elapsed += delta_ms;

    switch (this.phase) {
      case 'launch':
        this.update_launch(delta_ms);
        break;
      case 'explode':
      case 'fade':
        this.update_explosion(delta_ms);
        break;
    }

    this.update_trail(delta_ms);
  }

  private update_launch(delta_ms: number): void {
    // Move rocket up
    this.rocket_y -= this.ROCKET_SPEED * delta_ms;

    // Spawn trail particles
    if (this.elapsed - this.last_trail_spawn > this.TRAIL_SPAWN_INTERVAL) {
      this.spawn_trail_particle();
      this.last_trail_spawn = this.elapsed;
    }

    // Redraw rocket
    this.draw_rocket();

    // Check if reached target
    if (this.rocket_y <= this.rocket_target_y) {
      this.trigger_explosion();
    }
  }

  private spawn_trail_particle(): void {
    const graphics = new Graphics();
    const hue = 30 + Math.random() * 30; // Orange-ish

    graphics.circle(0, 0, 3 + Math.random() * 2);
    graphics.fill({ color: this.hsl_to_hex(hue, 100, 60) });

    const particle: Particle = {
      x: this.rocket_x + (Math.random() - 0.5) * 10,
      y: this.rocket_y + 20,
      vx: (Math.random() - 0.5) * 0.05,
      vy: 0.1 + Math.random() * 0.1,
      life: 400,
      max_life: 400,
      hue,
      size: 3,
      graphics,
    };

    graphics.position.set(particle.x, particle.y);
    this.container.addChild(graphics);
    this.trail_particles.push(particle);
  }

  private trigger_explosion(): void {
    this.phase = 'explode';

    // Remove rocket
    if (this.rocket_graphics) {
      this.container.removeChild(this.rocket_graphics);
      this.rocket_graphics.destroy();
      this.rocket_graphics = null;
    }

    // Create explosion flash
    this.create_explosion_flash();

    // Create explosion particles
    for (let i = 0; i < this.EXPLOSION_PARTICLE_COUNT; i++) {
      this.spawn_explosion_particle(i);
    }

    // Transition to fade phase after initial burst
    setTimeout(() => {
      this.phase = 'fade';
    }, 100);
  }

  private create_explosion_flash(): void {
    const flash = new Graphics();
    flash.circle(this.rocket_x, this.rocket_y, 80);
    flash.fill({ color: 0xffffff, alpha: 0.8 });

    this.container.addChild(flash);

    // Animate flash fade-out
    let alpha = 0.8;
    const fade_interval = setInterval(() => {
      alpha -= 0.1;
      if (alpha <= 0) {
        clearInterval(fade_interval);
        this.container.removeChild(flash);
        flash.destroy();
      } else {
        flash.clear();
        flash.circle(this.rocket_x, this.rocket_y, 80 + (0.8 - alpha) * 50);
        flash.fill({ color: 0xffffff, alpha });
      }
    }, 16);
  }

  private spawn_explosion_particle(index: number): void {
    const graphics = new Graphics();

    // Vary hue slightly around base color
    const hue = (this.explosion_hue + (Math.random() - 0.5) * 60 + 360) % 360;
    const color = this.hsl_to_hex(hue, 100, 60);

    const size = 4 + Math.random() * 4;
    graphics.circle(0, 0, size);
    graphics.fill({ color });

    // Calculate explosion direction
    const angle = (index / this.EXPLOSION_PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const speed = 0.3 + Math.random() * 0.4;

    const particle: Particle = {
      x: this.rocket_x,
      y: this.rocket_y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: this.PARTICLE_LIFETIME * (0.7 + Math.random() * 0.6),
      max_life: this.PARTICLE_LIFETIME,
      hue,
      size,
      graphics,
    };

    graphics.position.set(particle.x, particle.y);
    this.container.addChild(graphics);
    this.explosion_particles.push(particle);
  }

  private update_explosion(delta_ms: number): void {
    const gravity = 0.0004; // pixels per ms^2
    const friction = 0.995;

    for (const p of this.explosion_particles) {
      // Apply physics
      p.vy += gravity * delta_ms;
      p.vx *= friction;
      p.vy *= friction;

      p.x += p.vx * delta_ms;
      p.y += p.vy * delta_ms;
      p.life -= delta_ms;

      // Update graphics
      const alpha = Math.max(0, p.life / p.max_life);
      const scale = 0.5 + alpha * 0.5;

      p.graphics.position.set(p.x, p.y);
      p.graphics.scale.set(scale);
      p.graphics.alpha = alpha;
    }

    // Remove dead particles
    this.explosion_particles = this.explosion_particles.filter((p) => {
      if (p.life <= 0) {
        this.container.removeChild(p.graphics);
        p.graphics.destroy();
        return false;
      }
      return true;
    });
  }

  private update_trail(delta_ms: number): void {
    for (const p of this.trail_particles) {
      p.x += p.vx * delta_ms;
      p.y += p.vy * delta_ms;
      p.life -= delta_ms;

      const alpha = Math.max(0, p.life / p.max_life);
      p.graphics.position.set(p.x, p.y);
      p.graphics.alpha = alpha;
      p.graphics.scale.set(alpha);
    }

    // Remove dead trail particles
    this.trail_particles = this.trail_particles.filter((p) => {
      if (p.life <= 0) {
        this.container.removeChild(p.graphics);
        p.graphics.destroy();
        return false;
      }
      return true;
    });
  }

  is_complete(): boolean {
    return (
      this.phase === 'fade' &&
      this.explosion_particles.length === 0 &&
      this.trail_particles.length === 0
    );
  }

  destroy(): void {
    // Clean up remaining particles
    for (const p of [...this.trail_particles, ...this.explosion_particles]) {
      p.graphics.destroy();
    }
    if (this.rocket_graphics) {
      this.rocket_graphics.destroy();
    }
    this.container.destroy({ children: true });
  }

  /**
   * Convert HSL to hex color.
   */
  private hsl_to_hex(h: number, s: number, l: number): number {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0,
      g = 0,
      b = 0;

    if (h < 60) {
      r = c;
      g = x;
    } else if (h < 120) {
      r = x;
      g = c;
    } else if (h < 180) {
      g = c;
      b = x;
    } else if (h < 240) {
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }

    const ri = Math.round((r + m) * 255);
    const gi = Math.round((g + m) * 255);
    const bi = Math.round((b + m) * 255);

    return (ri << 16) | (gi << 8) | bi;
  }
}

