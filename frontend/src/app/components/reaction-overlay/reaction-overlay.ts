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
 * Displays emoji reactions floating up from the bottom (Google Meet style)
 * and greeting banners that slide in from the side.
 */

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
  style: string;
}

interface GreetingToast {
  id: number;
  text: string;
  location: string;
}

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
      max-width: 500px;
    }

    :host ::ng-deep .floating-emoji {
      position: absolute;
      bottom: -60px;
      font-size: 2.5rem;
      animation: float-up 3s ease-out forwards;
      filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));
      will-change: transform, opacity;
    }

    @keyframes float-up {
      0% {
        transform: translateY(0) scale(0.5) rotate(0deg);
        opacity: 0;
      }
      10% {
        transform: translateY(-20px) scale(1.2) rotate(-5deg);
        opacity: 1;
      }
      30% {
        transform: translateY(-100px) scale(1) rotate(5deg);
        opacity: 1;
      }
      100% {
        transform: translateY(-400px) scale(0.8) rotate(-10deg);
        opacity: 0;
      }
    }

    :host ::ng-deep .greeting-toast {
      background: linear-gradient(135deg, rgba(255, 45, 149, 0.9), rgba(191, 0, 255, 0.9));
      color: white;
      padding: 16px 24px;
      border-radius: 20px;
      font-family: 'Orbitron', sans-serif;
      font-size: 1rem;
      text-align: center;
      box-shadow: 0 4px 20px rgba(255, 45, 149, 0.4), 0 0 40px rgba(191, 0, 255, 0.3);
      animation: greeting-slide-in 0.5s ease-out, greeting-slide-out 0.5s ease-in 4.5s forwards;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    @keyframes greeting-slide-in {
      0% {
        transform: translateY(-50px) scale(0.8);
        opacity: 0;
      }
      100% {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
    }

    @keyframes greeting-slide-out {
      0% {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
      100% {
        transform: translateY(-30px) scale(0.8);
        opacity: 0;
      }
    }

    :host ::ng-deep .greeting-text {
      font-size: 1.1rem;
      font-weight: 500;
    }

    :host ::ng-deep .greeting-sparkle {
      display: inline-block;
      margin: 0 4px;
    }

    @media (max-width: 768px) {
      .greeting-container {
        top: 10px;
      }

      :host ::ng-deep .greeting-toast {
        padding: 12px 18px;
        font-size: 0.85rem;
      }

      :host ::ng-deep .floating-emoji {
        font-size: 2rem;
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
  private emoji_id = 0;
  private greeting_id = 0;

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
  }

  private show_reaction(reaction: ReactionBroadcast): void {
    if (!this.reaction_container) return;

    const container = this.reaction_container.nativeElement;
    const emoji_el = document.createElement('div');

    emoji_el.className = 'floating-emoji';
    emoji_el.textContent = reaction.emoji;

    // Random horizontal position
    const x_pos = 10 + Math.random() * 80; // 10% to 90%
    emoji_el.style.left = `${x_pos}%`;

    // Random animation variation
    const duration = 2.5 + Math.random() * 1;
    const delay = Math.random() * 0.2;
    emoji_el.style.animationDuration = `${duration}s`;
    emoji_el.style.animationDelay = `${delay}s`;

    container.appendChild(emoji_el);

    // Clean up after animation
    setTimeout(
      () => {
        emoji_el.remove();
      },
      (duration + delay + 0.5) * 1000
    );
  }

  private show_greeting(greeting: GreetingBroadcast): void {
    if (!this.greeting_container) return;

    const container = this.greeting_container.nativeElement;
    const toast_el = document.createElement('div');

    toast_el.className = 'greeting-toast';
    toast_el.innerHTML = `
      <span class="greeting-sparkle">✨</span>
      <span class="greeting-text">${this.escape_html(greeting.text)}</span>
      <span class="greeting-sparkle">✨</span>
    `;

    container.appendChild(toast_el);

    // Clean up after animation (5s total: 0.5s in + 4s visible + 0.5s out)
    setTimeout(() => {
      toast_el.remove();
    }, 5500);
  }

  private escape_html(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

