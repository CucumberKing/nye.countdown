import { Injectable, signal, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/**
 * JSON-RPC 2.0 WebSocket Service
 *
 * Provides a unified WebSocket connection with JSON-RPC protocol.
 * Handles:
 * - Connection management with auto-reconnect
 * - RPC request/response with correlation IDs
 * - Server notifications (broadcasts)
 */

export interface RpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
  id?: number | string;
}

export interface RpcResponse {
  jsonrpc: '2.0';
  id?: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface RpcNotification {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, unknown>;
}

type RpcMessage = RpcResponse | RpcNotification;

const RECONNECT_DELAY_MS = 5000;

@Injectable({
  providedIn: 'root',
})
export class WebSocketService implements OnDestroy {
  private ws: WebSocket | null = null;
  private reconnect_timeout: ReturnType<typeof setTimeout> | null = null;
  private request_id = 0;
  private pending_requests = new Map<
    number | string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: unknown) => void;
    }
  >();

  // Signals for connection state
  private readonly _is_connected = signal<boolean>(false);
  readonly is_connected = this._is_connected.asReadonly();

  // Subject for all incoming messages
  private readonly messages$ = new Subject<RpcMessage>();

  // Subject for notifications (broadcasts from server)
  private readonly notifications$ = new Subject<RpcNotification>();

  constructor() {
    this.connect();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }

  /**
   * Make an RPC call and wait for response.
   */
  async call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const id = ++this.request_id;
    const request: RpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    };

    return new Promise<T>((resolve, reject) => {
      this.pending_requests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      this.ws!.send(JSON.stringify(request));

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pending_requests.has(id)) {
          this.pending_requests.delete(id);
          reject(new Error(`RPC timeout for method: ${method}`));
        }
      }, 10000);
    });
  }

  /**
   * Send a notification (no response expected).
   */
  notify(method: string, params?: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, notification not sent');
      return;
    }

    const request: RpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.ws.send(JSON.stringify(request));
  }

  /**
   * Get observable stream of notifications for a specific method.
   */
  on_notification<T = Record<string, unknown>>(method: string): Observable<T> {
    return this.notifications$.pipe(
      filter((n) => n.method === method),
      map((n) => n.params as T)
    );
  }

  /**
   * Get observable stream of all notifications.
   */
  get all_notifications$(): Observable<RpcNotification> {
    return this.notifications$.asObservable();
  }

  private connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(environment.ws_url);

      this.ws.onopen = () => {
        console.log('✨ WebSocket connected');
        this._is_connected.set(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const message: RpcMessage = JSON.parse(event.data);
          this.handle_message(message);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this._is_connected.set(false);
        this.reject_pending_requests();
        this.schedule_reconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this._is_connected.set(false);
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      this.schedule_reconnect();
    }
  }

  private handle_message(message: RpcMessage): void {
    this.messages$.next(message);

    // Check if it's a response (has id)
    if ('id' in message && message.id !== undefined) {
      const pending = this.pending_requests.get(message.id);
      if (pending) {
        this.pending_requests.delete(message.id);
        if ('error' in message && message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve((message as RpcResponse).result);
        }
      }
    }
    // Check if it's a notification (has method, no id)
    else if ('method' in message) {
      this.notifications$.next(message as RpcNotification);
    }
  }

  private reject_pending_requests(): void {
    for (const [id, pending] of this.pending_requests) {
      pending.reject(new Error('WebSocket disconnected'));
      this.pending_requests.delete(id);
    }
  }

  private schedule_reconnect(): void {
    if (this.reconnect_timeout) {
      clearTimeout(this.reconnect_timeout);
    }

    this.reconnect_timeout = setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  private disconnect(): void {
    if (this.reconnect_timeout) {
      clearTimeout(this.reconnect_timeout);
      this.reconnect_timeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reject_pending_requests();
  }
}

