import { Injectable, type MessageEvent } from "@nestjs/common";
import { Observable, Subject } from "rxjs";

export interface KitchenEventPayload {
  course?: number;
  itemId?: string;
  orderId: string;
  restaurantId: string;
  status?: string;
  tableId?: string | null;
}

interface KitchenEventMessage {
  data: KitchenEventPayload;
  type: string;
}

@Injectable()
export class KitchenEventsService {
  private readonly streams = new Map<string, Set<Subject<MessageEvent>>>();

  stream(tenantId: string, restaurantId: string): Observable<MessageEvent> {
    const key = this.key(tenantId, restaurantId);
    const subject = new Subject<MessageEvent>();
    const listeners = this.streams.get(key) ?? new Set<Subject<MessageEvent>>();

    listeners.add(subject);
    this.streams.set(key, listeners);

    subject.next({
      data: { restaurantId },
      type: "connected",
    });

    return new Observable<MessageEvent>((subscriber) => {
      const subscription = subject.subscribe(subscriber);

      return () => {
        subscription.unsubscribe();
        subject.complete();
        listeners.delete(subject);

        if (listeners.size === 0) {
          this.streams.delete(key);
        }
      };
    });
  }

  publish(tenantId: string, event: KitchenEventMessage) {
    const listeners = this.streams.get(this.key(tenantId, event.data.restaurantId));

    if (!listeners) {
      return;
    }

    for (const listener of listeners) {
      listener.next(event);
    }
  }

  private key(tenantId: string, restaurantId: string) {
    return `${tenantId}:${restaurantId}`;
  }
}
