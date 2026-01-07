import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ReactionService, ReactionBroadcast } from '../../services/reaction.service';
import { GreetingService, GreetingBroadcast } from '../../services/greeting.service';

/**
 * Reaction Overlay Component
 *
 * Displays emoji reactions as rockets that explode into mini emojis,
 * and greeting banners that stay visible for extended periods.
 */

// How long greetings stay visible (15 minutes)
const GREETING_DURATION_MS = 15 * 60 * 1000;

@Component({
  selector: 'app-reaction-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="reaction-container" #reaction_container></div>
    <div class="greeting-container" #greeting_container></div>
  `,
  styles: `
    .reaction-container {
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 200;
      overflow: hidden;
    }

    .greeting-container {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      pointer-events: none;
      z-index: 201;
      width: 90%;
      max-width: 600px;
    }

    /* Rocket emoji that shoots up - smooth GPU-accelerated animation */
    :host ::ng-deep .rocket-emoji {
      position: absolute;
      bottom: -80px;
      font-size: 3rem;
      animation: rocket-launch 1.1s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
      filter: drop-shadow(0 0 20px rgba(255, 200, 0, 0.8));
      will-change: transform, opacity;
      transform-style: preserve-3d;
      backface-visibility: hidden;
      -webkit-font-smoothing: antialiased;
    }

    @keyframes rocket-launch {
      0% {
        transform: translateY(0) scale(0.6);
        opacity: 0;
      }
      8% {
        transform: translateY(-30px) scale(1.1);
        opacity: 1;
      }
      75% {
        transform: translateY(-420px) scale(1.3);
        opacity: 1;
      }
      100% {
        transform: translateY(-520px) scale(0.4);
        opacity: 0;
      }
    }

    /* Trail effect behind rocket */
    :host ::ng-deep .rocket-trail {
      position: absolute;
      font-size: 1.5rem;
      animation: trail-fade 0.8s ease-out forwards;
      opacity: 0.6;
      will-change: transform, opacity;
    }

    @keyframes trail-fade {
      0% {
        transform: scale(1);
        opacity: 0.6;
      }
      100% {
        transform: scale(0.3) translateY(30px);
        opacity: 0;
      }
    }

    /* Explosion particle emojis */
    :host ::ng-deep .explosion-particle {
      position: absolute;
      font-size: 2rem;
      animation: explode var(--explode-duration, 1.5s) ease-out forwards;
      animation-delay: var(--explode-delay, 0s);
      opacity: 0;
      will-change: transform, opacity;
      filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.8));
    }

    @keyframes explode {
      0% {
        transform: translate(0, 0) scale(0.3) rotate(0deg);
        opacity: 0;
      }
      15% {
        transform: translate(
            calc(var(--explode-x, 0px) * 0.3),
            calc(var(--explode-y, 0px) * 0.3)
          )
          scale(1.8)
          rotate(var(--explode-rotation, 0deg));
        opacity: 1;
      }
      50% {
        transform: translate(var(--explode-x, 0px), var(--explode-y, 0px))
          scale(1.2)
          rotate(calc(var(--explode-rotation, 0deg) * 2));
        opacity: 1;
      }
      100% {
        transform: translate(
            calc(var(--explode-x, 0px) * 1.5),
            calc(var(--explode-y, 0px) * 1.5 + 100px)
          )
          scale(0.5)
          rotate(calc(var(--explode-rotation, 0deg) * 3));
        opacity: 0;
      }
    }

    /* Flash effect at explosion point */
    :host ::ng-deep .explosion-flash {
      position: absolute;
      width: 200px;
      height: 200px;
      border-radius: 50%;
      background: radial-gradient(
        circle,
        rgba(255, 255, 255, 0.9) 0%,
        rgba(255, 200, 100, 0.6) 30%,
        rgba(255, 100, 150, 0.3) 60%,
        transparent 80%
      );
      transform: translate(-50%, -50%) scale(0);
      animation: flash-expand 0.6s ease-out forwards;
      pointer-events: none;
    }

    @keyframes flash-expand {
      0% {
        transform: translate(-50%, -50%) scale(0);
        opacity: 1;
      }
      50% {
        transform: translate(-50%, -50%) scale(1.5);
        opacity: 0.8;
      }
      100% {
        transform: translate(-50%, -50%) scale(2.5);
        opacity: 0;
      }
    }

    /* Greeting toast - extended duration */
    :host ::ng-deep .greeting-toast {
      background: linear-gradient(135deg, rgba(255, 45, 149, 0.95), rgba(191, 0, 255, 0.95));
      color: white;
      padding: 20px 32px;
      border-radius: 24px;
      font-family: 'Orbitron', sans-serif;
      font-size: 1.1rem;
      text-align: center;
      box-shadow:
        0 8px 40px rgba(255, 45, 149, 0.5),
        0 0 60px rgba(191, 0, 255, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.3);
      animation:
        greeting-slide-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
        greeting-glow 3s ease-in-out infinite 0.6s;
      backdrop-filter: blur(15px);
      border: 2px solid rgba(255, 255, 255, 0.3);
      max-width: 100%;
    }

    :host ::ng-deep .greeting-toast.fading-out {
      animation: greeting-slide-out 0.8s ease-in forwards;
    }

    @keyframes greeting-slide-in {
      0% {
        transform: translateY(-80px) scale(0.5) rotateX(45deg);
        opacity: 0;
      }
      100% {
        transform: translateY(0) scale(1) rotateX(0deg);
        opacity: 1;
      }
    }

    @keyframes greeting-glow {
      0%, 100% {
        box-shadow:
          0 8px 40px rgba(255, 45, 149, 0.5),
          0 0 60px rgba(191, 0, 255, 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.3);
      }
      50% {
        box-shadow:
          0 8px 60px rgba(255, 45, 149, 0.7),
          0 0 80px rgba(191, 0, 255, 0.6),
          0 0 100px rgba(0, 245, 255, 0.3),
          inset 0 1px 0 rgba(255, 255, 255, 0.4);
      }
    }

    @keyframes greeting-slide-out {
      0% {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
      100% {
        transform: translateY(-50px) scale(0.8) rotateX(-20deg);
        opacity: 0;
      }
    }

    :host ::ng-deep .greeting-text {
      font-size: 1.2rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    :host ::ng-deep .greeting-sparkle {
      display: inline-block;
      margin: 0 8px;
      animation: sparkle-spin 2s linear infinite;
    }

    @keyframes sparkle-spin {
      0% { transform: rotate(0deg) scale(1); }
      25% { transform: rotate(90deg) scale(1.2); }
      50% { transform: rotate(180deg) scale(1); }
      75% { transform: rotate(270deg) scale(1.2); }
      100% { transform: rotate(360deg) scale(1); }
    }

    @media (max-width: 768px) {
      .greeting-container {
        top: 10px;
        width: 95%;
      }

      :host ::ng-deep .greeting-toast {
        padding: 16px 24px;
        font-size: 0.95rem;
        border-radius: 18px;
      }

      :host ::ng-deep .rocket-emoji {
        font-size: 2.5rem;
      }

      :host ::ng-deep .explosion-particle {
        font-size: 1.5rem;
      }
    }
  `,
})
export class ReactionOverlayComponent implements OnInit, OnDestroy {
  private readonly reaction_service = inject(ReactionService);
  private readonly greeting_service = inject(GreetingService);

  @ViewChild('reaction_container') reaction_container!: ElementRef<HTMLDivElement>;
  @ViewChild('greeting_container') greeting_container!: ElementRef<HTMLDivElement>;

  private subscriptions: Subscription[] = [];
  private current_greeting_el: HTMLElement | null = null;
  private greeting_timeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    // Subscribe to reactions
    this.subscriptions.push(
      this.reaction_service.reactions$.subscribe((reaction) => {
        this.show_reaction(reaction);
      })
    );

    // Subscribe to greetings
    this.subscriptions.push(
      this.greeting_service.greetings$.subscribe((greeting) => {
        this.show_greeting(greeting);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    if (this.greeting_timeout) {
      clearTimeout(this.greeting_timeout);
    }
  }

  private show_reaction(reaction: ReactionBroadcast): void {
    if (!this.reaction_container) return;

    const container = this.reaction_container.nativeElement;

    // Random horizontal position for the rocket
    const x_pos = 15 + Math.random() * 70; // 15% to 85%
    const explosion_height = 400 + Math.random() * 150; // Where the explosion happens

    // Create the rocket emoji
    const rocket_el = document.createElement('div');
    rocket_el.className = 'rocket-emoji';
    rocket_el.textContent = reaction.emoji;
    rocket_el.style.left = `${x_pos}%`;
    container.appendChild(rocket_el);

    // Create trail particles
    this.create_rocket_trail(container, x_pos, reaction.emoji);

    // Schedule the explosion
    setTimeout(() => {
      // Create flash effect
      this.create_explosion_flash(container, x_pos, explosion_height);

      // Create explosion particles
      this.create_explosion_particles(container, x_pos, explosion_height, reaction.emoji);
    }, 900); // Explode near the end of rocket animation

    // Clean up rocket
    setTimeout(() => {
      rocket_el.remove();
    }, 1300);
  }

  private create_rocket_trail(container: HTMLElement, x_pos: number, emoji: string): void {
    const trail_count = 5;
    for (let i = 0; i < trail_count; i++) {
      setTimeout(() => {
        const trail = document.createElement('div');
        trail.className = 'rocket-trail';
        trail.textContent = '✨';
        trail.style.left = `${x_pos + (Math.random() - 0.5) * 3}%`;
        trail.style.bottom = `${50 + i * 60}px`;
        container.appendChild(trail);

        setTimeout(() => trail.remove(), 800);
      }, i * 100);
    }
  }

  private create_explosion_flash(container: HTMLElement, x_pos: number, height: number): void {
    const flash = document.createElement('div');
    flash.className = 'explosion-flash';
    flash.style.left = `${x_pos}%`;
    flash.style.bottom = `${height}px`;
    container.appendChild(flash);

    setTimeout(() => flash.remove(), 600);
  }

  private create_explosion_particles(
    container: HTMLElement,
    x_pos: number,
    height: number,
    emoji: string
  ): void {
    const particle_count = 8 + Math.floor(Math.random() * 5); // 8-12 particles

    for (let i = 0; i < particle_count; i++) {
      const particle = document.createElement('div');
      particle.className = 'explosion-particle';
      particle.textContent = emoji;

      // Position at explosion point
      particle.style.left = `${x_pos}%`;
      particle.style.bottom = `${height}px`;

      // Random explosion direction
      const angle = (i / particle_count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const distance = 80 + Math.random() * 120;
      const explode_x = Math.cos(angle) * distance;
      const explode_y = Math.sin(angle) * distance * 0.7; // Flatten vertically

      // Set CSS variables for the animation
      particle.style.setProperty('--explode-x', `${explode_x}px`);
      particle.style.setProperty('--explode-y', `${-explode_y}px`); // Negative because bottom-based
      particle.style.setProperty('--explode-rotation', `${(Math.random() - 0.5) * 360}deg`);
      particle.style.setProperty('--explode-duration', `${1.2 + Math.random() * 0.8}s`);
      particle.style.setProperty('--explode-delay', `${Math.random() * 0.15}s`);

      container.appendChild(particle);

      // Clean up
      setTimeout(() => particle.remove(), 2500);
    }
  }

  private show_greeting(greeting: GreetingBroadcast): void {
    if (!this.greeting_container) return;

    const container = this.greeting_container.nativeElement;

    // If there's an existing greeting, fade it out first
    if (this.current_greeting_el) {
      const old_greeting = this.current_greeting_el;
      old_greeting.classList.add('fading-out');
      setTimeout(() => old_greeting.remove(), 800);

      if (this.greeting_timeout) {
        clearTimeout(this.greeting_timeout);
      }
    }

    // Create new greeting toast
    const toast_el = document.createElement('div');
    toast_el.className = 'greeting-toast';
    toast_el.innerHTML = `
      <span class="greeting-sparkle">✨</span>
      <span class="greeting-text">${this.escape_html(greeting.text)}</span>
      <span class="greeting-sparkle">✨</span>
    `;

    container.appendChild(toast_el);
    this.current_greeting_el = toast_el;

    // Schedule removal after extended duration (15 minutes)
    this.greeting_timeout = setTimeout(() => {
      if (this.current_greeting_el === toast_el) {
        toast_el.classList.add('fading-out');
        setTimeout(() => {
          toast_el.remove();
          if (this.current_greeting_el === toast_el) {
            this.current_greeting_el = null;
          }
        }, 800);
      }
    }, GREETING_DURATION_MS);
  }

  private escape_html(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
