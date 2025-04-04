// Event types
export enum EventType {
  GAME_STARTED = 'game_started',
  GAME_ENDED = 'game_ended',
  QUESTION_LOADED = 'question_loaded',
  ANSWER_SUBMITTED = 'answer_submitted',
  USER_REGISTERED = 'user_registered',
  USER_LOGGED_IN = 'user_logged_in',
  SCORE_SAVED = 'score_saved',
  HIGH_SCORE_ACHIEVED = 'high_score_achieved'
}

// Event payload type
export interface EventPayload {
  [key: string]: any;
}

// Event handler function type
export type EventHandler = (payload: EventPayload) => void;

export class EventService {
  private static instance: EventService;
  private listeners: Map<EventType, EventHandler[]>;
  private history: Array<{ type: EventType, payload: EventPayload, timestamp: Date }>;

  private constructor() {
    this.listeners = new Map();
    this.history = [];
  }

  // Singleton pattern to ensure only one event service exists
  public static getInstance(): EventService {
    if (!EventService.instance) {
      EventService.instance = new EventService();
    }
    return EventService.instance;
  }

  // Subscribe to an event
  public subscribe(eventType: EventType, handler: EventHandler): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    this.listeners.get(eventType)!.push(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.listeners.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  // Publish an event
  public publish(eventType: EventType, payload: EventPayload = {}): void {
    // Store in history
    this.history.push({
      type: eventType,
      payload,
      timestamp: new Date()
    });
    
    // Notify all subscribers
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      });
    }
  }

  // Get event history
  public getHistory(): Array<{ type: EventType, payload: EventPayload, timestamp: Date }> {
    return [...this.history];
  }

  // Clear history
  public clearHistory(): void {
    this.history = [];
  }
} 