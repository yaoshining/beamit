// Test setup file
import { beforeAll, afterEach, afterAll, vi } from 'vitest';

// Mock chrome API for tests
beforeAll(() => {
  global.chrome = {
    runtime: {
      id: 'test-extension-id',
      getURL: (path: string) => `chrome-extension://test-extension-id/${path}`,
      sendMessage: () => Promise.resolve(),
      onMessage: { addListener: () => {} }
    },
    storage: {
      local: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve(),
        remove: () => Promise.resolve()
      },
      session: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve()
      }
    },
    tabs: {
      query: () => Promise.resolve([])
    }
  } as any;
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  delete (global as any).chrome;
});