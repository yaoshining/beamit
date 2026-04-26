import { defineConfig } from 'plasmo';

export default defineConfig({
  manifest: {
    host_permissions: ['<all_urls>'],
    permissions: ['storage', 'activeTab', 'tabs', 'scripting'],
    background: {
      service_worker: 'src/background/index.ts',
      type: 'module'
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['src/content/index.ts'],
        run_at: 'document_idle'
      }
    ],
    action: {
      default_popup: 'src/popup/index.html',
      default_icon: {
        16: 'assets/icon-16.png',
        32: 'assets/icon-32.png',
        48: 'assets/icon-48.png',
        128: 'assets/icon-128.png'
      }
    },
    icons: {
      16: 'assets/icon-16.png',
      32: 'assets/icon-32.png',
      48: 'assets/icon-48.png',
      128: 'assets/icon-128.png'
    }
  }
});