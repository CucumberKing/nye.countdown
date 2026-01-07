import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  inject,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ReactionService, ReactionBroadcast } from '../../services/reaction.service';
import { GreetingService, GreetingBroadcast } from '../../services/greeting.service';
import { EffectEngineService } from '../../services/effect-engine.service';

/**
 * Reaction Overlay Component
 *
 * Displays emoji reactions using GPU-accelerated PixiJS effects,
 * and greeting banners that stay visible for extended periods.
 */

// How long greetings stay visible (15 minutes)
const GREETING_DURATION_MS = 15 * 60 * 1000;

@Component({
  selector: 'app-reaction-overlay',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="effect-container" #effect_container></div>
    <div class="greeting-container" #greeting_container></div>
  `,
  styles: `
    .effect-container {
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
    }
  `,
})
export class ReactionOverlayComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly reaction_service = inject(ReactionService);
  private readonly greeting_service = inject(GreetingService);
  private readonly effect_engine = inject(EffectEngineService);

  @ViewChild('effect_container') effect_container!: ElementRef<HTMLDivElement>;
  @ViewChild('greeting_container') greeting_container!: ElementRef<HTMLDivElement>;

  private subscriptions: Subscription[] = [];
  private current_greeting_el: HTMLElement | null = null;
  private greeting_timeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    // Subscribe to greetings
    this.subscriptions.push(
      this.greeting_service.greetings$.subscribe((greeting) => {
        this.show_greeting(greeting);
      })
    );
  }

  async ngAfterViewInit(): Promise<void> {
    // Initialize PixiJS effect engine
    await this.effect_engine.init(this.effect_container.nativeElement);

    // Subscribe to reactions after engine is ready
    this.subscriptions.push(
      this.reaction_service.reactions$.subscribe((reaction) => {
        this.show_reaction(reaction);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    if (this.greeting_timeout) {
      clearTimeout(this.greeting_timeout);
    }
    this.effect_engine.destroy();
  }

  private show_reaction(reaction: ReactionBroadcast): void {
    // Delegate to PixiJS effect engine
    this.effect_engine.trigger(reaction.emoji);
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
