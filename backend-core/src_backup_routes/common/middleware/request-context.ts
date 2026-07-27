import { AsyncLocalStorage } from 'async_hooks';

export interface RequestStore {
  requestId: string;
  traceId: string;
  userId?: string;
}

export class RequestContext {
  private static readonly als = new AsyncLocalStorage<RequestStore>();

  static run(store: RequestStore, callback: () => void): void {
    this.als.run(store, callback);
  }

  static getStore(): RequestStore | undefined {
    return this.als.getStore();
  }

  static get requestId(): string | undefined {
    return this.getStore()?.requestId;
  }

  static get traceId(): string | undefined {
    return this.getStore()?.traceId;
  }

  static get userId(): string | undefined {
    return this.getStore()?.userId;
  }

  static set userId(id: string | undefined) {
    const store = this.getStore();
    if (store) {
      store.userId = id;
    }
  }
}
