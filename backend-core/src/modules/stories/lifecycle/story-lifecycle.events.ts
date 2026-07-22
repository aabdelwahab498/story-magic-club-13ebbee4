import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { StoryEventPayload } from './interfaces/lifecycle.interfaces.js';

export interface StoryEvent {
  type: string;
  payload: StoryEventPayload;
}

@Injectable()
export class StoryLifecycleEvents {
  private eventSubject = new Subject<StoryEvent>();

  /**
   * Returns an observable of all story lifecycle events.
   */
  get events$(): Observable<StoryEvent> {
    return this.eventSubject.asObservable();
  }

  emit(type: string, payload: StoryEventPayload): void {
    this.eventSubject.next({ type, payload });
  }

  emitQueued(payload: StoryEventPayload): void {
    this.emit('StoryQueued', payload);
  }

  emitGenerationStarted(payload: StoryEventPayload): void {
    this.emit('StoryGenerationStarted', payload);
  }

  emitGenerationCompleted(payload: StoryEventPayload): void {
    this.emit('StoryGenerationCompleted', payload);
  }

  emitGenerationFailed(payload: StoryEventPayload): void {
    this.emit('StoryGenerationFailed', payload);
  }

  emitCancelled(payload: StoryEventPayload): void {
    this.emit('StoryCancelled', payload);
  }
}
