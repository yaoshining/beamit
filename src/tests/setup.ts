// Test setup file
import { beforeAll, afterEach, afterAll, vi } from 'vitest';
import '@testing-library/jest-dom';

/**
 * Shared mock storage object used by chrome.storage mocks.
 * Test files can read/write this directly for setup and assertions.
 * Use (global as any).__mockStorageData to access it.
 */
const mockStorageData: Record<string, any> = {};
(global as any).__mockStorageData = mockStorageData;

/**
 * Helper to clear the shared mock storage (used in beforeEach).
 */
(global as any).__clearMockStorage = () => {
  Object.keys(mockStorageData).forEach((k) => delete mockStorageData[k]);
};

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
        get: (key: string) => {
          const val = mockStorageData[key];
          return Promise.resolve(val !== undefined ? { [key]: val } as any : {});
        },
        set: (items: Record<string, any>) => {
          Object.assign(mockStorageData, items);
          return Promise.resolve();
        },
        remove: (key: string) => {
          delete mockStorageData[key];
          return Promise.resolve();
        }
      },
      session: {
        get: (key: string) => {
          const val = mockStorageData[key];
          return Promise.resolve(val !== undefined ? { [key]: val } as any : {});
        },
        set: (items: Record<string, any>) => {
          Object.assign(mockStorageData, items);
          return Promise.resolve();
        },
        remove: (key: string) => {
          delete mockStorageData[key];
          return Promise.resolve();
        },
        clear: () => {
          Object.keys(mockStorageData).forEach((k) => delete mockStorageData[k]);
          return Promise.resolve();
        }
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
  delete (global as any).__mockStorageData;
  delete (global as any).__clearMockStorage;
});