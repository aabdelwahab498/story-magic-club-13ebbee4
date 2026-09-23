import { AsyncLocalStorage } from 'async_hooks';

export interface RequestStore {
  requestId: string;
  traceId: string;
  userId?: string;
  authToken?: string;
}

export class RequestContext {
  private static readonly als = new AsyncLocalStorage<RequestStore>();

  static run<T>(store: RequestStore, callback: () => T): T {
    return this.als.run(store, callback);
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

  static get authToken(): string | undefined {
    return this.getStore()?.authToken;
  }

  static set authToken(token: string | undefined) {
    const store = this.getStore();
    if (store) {
      store.authToken = token;
    }
  }
}
