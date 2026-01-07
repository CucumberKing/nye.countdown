import { Container, Graphics, BlurFilter } from 'pixi.js';
import { Effect, EffectConfig, generate_effect_id } from './base-effect';

/**
 * Disco Effect
 *
 * A disco ball appears in the center with rotating light beams
 * emanating outward. Uses additive blending for glow effects.
 */

interface LightBeam {
  angle: number;
  length: number;
  width: number;
  hue: number;
  speed: number;
  graphics: Graphics;
}

export class DiscoEffect implements Effect {
  readonly id = generate_effect_id();
  readonly container = new Container();

  private ball_graphics: Graphics | null = null;
  private ball_sparkles: Graphics | null = null;
  private beams: LightBeam[] = [];
  private center_x = 0;
  private center_y = 0;
  private width = 0;
  private height = 0;
  private elapsed = 0;
  private sparkle_rotation = 0;

  private readonly DURATION = 3000; // 3 seconds
  private readonly BEAM_COUNT = 12;
  private readonly BALL_RADIUS = 40;

  spawn(config: EffectConfig): void {
    this.width = config.width;
    this.height = config.height;
    this.center_x = config.width / 2;
    this.center_y = config.height * 0.35;

    this.create_ball();
    this.create_beams();
  }

  private create_ball(): void {
    // Main disco ball
    this.ball_graphics = new Graphics();

    // Outer glow
    this.ball_graphics.circle(this.center_x, this.center_y, this.BALL_RADIUS + 20);
    this.ball_graphics.fill({ color: 0xffffff, alpha: 0.15 });

    // Main ball with gradient effect (approximated with circles)
    this.ball_graphics.circle(this.center_x, this.center_y, this.BALL_RADIUS);
    this.ball_graphics.fill({ color: 0xcccccc });

    // Highlight
    this.ball_graphics.circle(
      this.center_x - this.BALL_RADIUS * 0.3,
      this.center_y - this.BALL_RADIUS * 0.3,
      this.BALL_RADIUS * 0.4
    );
    this.ball_graphics.fill({ color: 0xffffff, alpha: 0.6 });

    this.container.addChild(this.ball_graphics);

    // Sparkle overlay that rotates
    this.ball_sparkles = new Graphics();
    this.draw_sparkles();
    this.container.addChild(this.ball_sparkles);
  }

  private draw_sparkles(): void {
    if (!this.ball_sparkles) return;

    this.ball_sparkles.clear();

    // Draw small reflective squares on the ball
    const grid_size = 8;
    for (let i = 0; i < grid_size; i++) {
      for (let j = 0; j < grid_size; j++) {
        const angle = (i / grid_size) * Math.PI * 2 + this.sparkle_rotation;
        const y_offset = ((j / grid_size) * 2 - 1) * this.BALL_RADIUS * 0.8;

        // Only draw if on front hemisphere
        const x_pos = Math.cos(angle) * Math.sqrt(this.BALL_RADIUS ** 2 - y_offset ** 2) * 0.8;
        const z = Math.sin(angle);

        if (z > 0) {
          const brightness = 0.3 + z * 0.7;
          const size = 4 + z * 4;

          this.ball_sparkles.rect(
            this.center_x + x_pos - size / 2,
            this.center_y + y_offset - size / 2,
            size,
            size
          );
          this.ball_sparkles.fill({ color: 0xffffff, alpha: brightness * 0.8 });
        }
      }
    }
  }

  private create_beams(): void {
    for (let i = 0; i < this.BEAM_COUNT; i++) {
      const angle = (i / this.BEAM_COUNT) * Math.PI * 2;
      const graphics = new Graphics();

      // Apply blur for glow effect
      graphics.filters = [new BlurFilter({ strength: 3 })];

      const beam: LightBeam = {
        angle,
        length: Math.min(this.width, this.height) * 0.6,
        width: 30 + Math.random() * 20,
        hue: (i / this.BEAM_COUNT) * 360,
        speed: 0.5 + Math.random() * 0.5,
        graphics,
      };

      this.container.addChild(graphics);
      this.beams.push(beam);
    }
  }

  update(delta_ms: number): void {
    this.elapsed += delta_ms;

    // Calculate fade in/out
    let alpha = 1;
    const fade_duration = 300;
    if (this.elapsed < fade_duration) {
      alpha = this.elapsed / fade_duration;
    } else if (this.elapsed > this.DURATION - fade_duration) {
      alpha = Math.max(0, (this.DURATION - this.elapsed) / fade_duration);
    }

    this.container.alpha = alpha;

    // Rotate sparkles
    this.sparkle_rotation += delta_ms * 0.002;
    this.draw_sparkles();

    // Update beams
    for (const beam of this.beams) {
      beam.angle += beam.speed * delta_ms * 0.001;
      beam.hue = (beam.hue + delta_ms * 0.05) % 360;

      this.draw_beam(beam);
    }
  }

  private draw_beam(beam: LightBeam): void {
    beam.graphics.clear();

    const end_x = this.center_x + Math.cos(beam.angle) * beam.length;
    const end_y = this.center_y + Math.sin(beam.angle) * beam.length;

    // Beam gradient effect using multiple lines
    const color = this.hsl_to_hex(beam.hue, 100, 60);
    const segments = 10;

    for (let i = 0; i < segments; i++) {
      const t1 = i / segments;
      const t2 = (i + 1) / segments;

      const x1 = this.center_x + (end_x - this.center_x) * t1;
      const y1 = this.center_y + (end_y - this.center_y) * t1;
      const x2 = this.center_x + (end_x - this.center_x) * t2;
      const y2 = this.center_y + (end_y - this.center_y) * t2;

      // Width tapers and alpha fades toward end
      const width = beam.width * (1 - t1 * 0.8);
      const seg_alpha = (1 - t1) * 0.4;

      // Draw segment as a polygon
      const perp_x = -Math.sin(beam.angle) * width / 2;
      const perp_y = Math.cos(beam.angle) * width / 2;

      beam.graphics.poly([
        { x: x1 + perp_x, y: y1 + perp_y },
        { x: x1 - perp_x, y: y1 - perp_y },
        { x: x2 - perp_x * 0.8, y: y2 - perp_y * 0.8 },
        { x: x2 + perp_x * 0.8, y: y2 + perp_y * 0.8 },
      ]);
      beam.graphics.fill({ color, alpha: seg_alpha });
    }
  }

  is_complete(): boolean {
    return this.elapsed >= this.DURATION;
  }

  destroy(): void {
    for (const beam of this.beams) {
      beam.graphics.destroy();
    }
    if (this.ball_graphics) {
      this.ball_graphics.destroy();
    }
    if (this.ball_sparkles) {
      this.ball_sparkles.destroy();
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

