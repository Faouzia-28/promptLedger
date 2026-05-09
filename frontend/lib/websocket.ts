/**
 * WebSocket integration for real-time drift notifications
 */

import React from 'react';

export interface DriftNotification {
  type: 'drift_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  drift_score: number;
  unit_id: string;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private orgId: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isDisconnecting = false;
  private listeners: ((data: DriftNotification) => void)[] = [];

  constructor(orgId: string) {
    this.orgId = orgId;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
    this.url = `${wsUrl}/ws/drift/${orgId}`;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.isDisconnecting = false;
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data: DriftNotification = JSON.parse(event.data);
            this.listeners.forEach((listener) => listener(data));
          } catch (e) {
            console.error('[WebSocket] Failed to parse message:', e);
          }
        };

        this.ws.onerror = (error) => {
          if (this.isDisconnecting) {
            return;
          }

          console.warn('[WebSocket] Connection error');
          reject(error);
        };

        this.ws.onclose = () => {
          if (this.isDisconnecting) {
            return;
          }

          console.log('[WebSocket] Disconnected');
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
      console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect().catch(console.error), delay);
    }
  }

  subscribe(listener: (data: DriftNotification) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  disconnect() {
    if (this.ws) {
      this.isDisconnecting = true;
      this.ws.close();
      this.ws = null;
    }
  }
}

export function useWebSocket(orgId: string) {
  const clientRef = React.useRef<WebSocketClient | null>(null);

  React.useEffect(() => {
    clientRef.current = new WebSocketClient(orgId);
    clientRef.current.connect().catch(console.error);

    return () => {
      clientRef.current?.disconnect();
    };
  }, [orgId]);

  return clientRef.current;
}
