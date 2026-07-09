import { CollectionCall } from './types';

const DB_NAME = 'disha_phlebo_db';
const DB_VERSION = 1;

export interface PendingSyncItem {
  id: string;
  callId: string;
  status: string;
  phleboId: string;
  updates?: any;
  timestamp: number;
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending_sync')) {
        db.createObjectStore('pending_sync', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('calls')) {
        db.createObjectStore('calls', { keyPath: 'id' });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };

    request.onerror = (event: any) => {
      reject(event.target.error || new Error('Failed to open IndexedDB'));
    };
  });
}

export const indexedDbHelper = {
  // Calls operations
  async saveCalls(calls: CollectionCall[]): Promise<void> {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('calls', 'readwrite');
        const store = transaction.objectStore('calls');
        
        // Clear old entries and insert new ones
        store.clear();
        for (const call of calls) {
          store.put(call);
        }

        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(transaction.error || e);
      });
    } catch (err) {
      console.warn('IndexedDB saveCalls error, falling back:', err);
    }
  },

  async updateCall(call: CollectionCall): Promise<void> {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('calls', 'readwrite');
        const store = transaction.objectStore('calls');
        store.put(call);
        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(transaction.error || e);
      });
    } catch (err) {
      console.warn('IndexedDB updateCall error, falling back:', err);
    }
  },

  async getCalls(): Promise<CollectionCall[]> {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('calls', 'readonly');
        const store = transaction.objectStore('calls');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (e) => reject(request.error || e);
      });
    } catch (err) {
      console.warn('IndexedDB getCalls error, falling back:', err);
      return [];
    }
  },

  // Pending Sync operations
  async getPendingSync(): Promise<PendingSyncItem[]> {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('pending_sync', 'readonly');
        const store = transaction.objectStore('pending_sync');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = (e) => reject(request.error || e);
      });
    } catch (err) {
      console.warn('IndexedDB getPendingSync error, falling back:', err);
      return [];
    }
  },

  async addPendingSync(item: PendingSyncItem): Promise<void> {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('pending_sync', 'readwrite');
        const store = transaction.objectStore('pending_sync');
        store.put(item);
        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(transaction.error || e);
      });
    } catch (err) {
      console.warn('IndexedDB addPendingSync error, falling back:', err);
    }
  },

  async savePendingSyncList(items: PendingSyncItem[]): Promise<void> {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('pending_sync', 'readwrite');
        const store = transaction.objectStore('pending_sync');
        store.clear();
        for (const item of items) {
          store.put(item);
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(transaction.error || e);
      });
    } catch (err) {
      console.warn('IndexedDB savePendingSyncList error, falling back:', err);
    }
  },

  async deletePendingSync(id: string): Promise<void> {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('pending_sync', 'readwrite');
        const store = transaction.objectStore('pending_sync');
        store.delete(id);
        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(transaction.error || e);
      });
    } catch (err) {
      console.warn('IndexedDB deletePendingSync error, falling back:', err);
    }
  },

  async clearPendingSync(): Promise<void> {
    try {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('pending_sync', 'readwrite');
        const store = transaction.objectStore('pending_sync');
        store.clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = (e) => reject(transaction.error || e);
      });
    } catch (err) {
      console.warn('IndexedDB clearPendingSync error, falling back:', err);
    }
  }
};
