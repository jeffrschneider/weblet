/**
 * Weblet Storage Module
 *
 * Manages ephemeral (.data/) and persistent (.userdata/) storage for weblets.
 * Based on storage.spec.md
 */

import { mkdir, stat, readdir, appendFile, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

import type { ParsedManifest, StorageConfig } from "../parser/schema.ts";

// =============================================================================
// Types
// =============================================================================

export interface StorageUsage {
  appState: {
    used: number;
    limit: number;
    percentage: number;
  };
  userData: {
    used: number;
    limit: number;
    percentage: number;
  };
}

export interface StorageManager {
  /** Root directory of the weblet */
  readonly root: string;

  /** Get ephemeral storage path (.data/) */
  getAppStatePath(): string;

  /** Get persistent storage path (.userdata/) */
  getUserDataPath(): string;

  /** Check storage usage */
  getUsage(): Promise<StorageUsage>;

  /** Check if write would exceed limits */
  canWrite(path: string, size: number): Promise<boolean>;

  /** Clear ephemeral storage */
  clearAppState(): Promise<void>;

  /** Get storage configuration */
  getConfig(): StorageConfig;
}

export interface StorageOptions {
  /** Create directories if they don't exist */
  createDirs?: boolean;
  /** Update .gitignore to exclude .data/ */
  updateGitignore?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const APP_STATE_DIR = ".data";
const USER_DATA_DIR = ".userdata";

const DEFAULT_APP_STATE_MAX = "10MB";
const DEFAULT_USER_DATA_MAX = "100MB";

// =============================================================================
// Size Parsing
// =============================================================================

const SIZE_UNITS: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
};

/**
 * Parse a size string (e.g., "10MB") to bytes.
 */
export function parseSize(size: string): number {
  const match = size.trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);

  if (!match) {
    throw new StorageError(
      "E-STOR-005",
      `Invalid size format: ${size}. Expected format: <number><unit> (e.g., 10MB)`
    );
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  return Math.floor(value * SIZE_UNITS[unit]);
}

/**
 * Format bytes as human-readable size string.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

// =============================================================================
// Directory Size Calculation
// =============================================================================

/**
 * Calculate total size of a directory recursively.
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  if (!existsSync(dirPath)) {
    return 0;
  }

  let totalSize = 0;

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        totalSize += await getDirectorySize(entryPath);
      } else if (entry.isFile()) {
        const stats = await stat(entryPath);
        totalSize += stats.size;
      }
    }
  } catch {
    // Directory might not exist or be readable
    return 0;
  }

  return totalSize;
}

// =============================================================================
// Gitignore Management
// =============================================================================

/**
 * Ensure .data/ is in .gitignore
 */
async function updateGitignore(root: string): Promise<void> {
  const gitignorePath = join(root, ".gitignore");
  const dataEntry = ".data/";

  try {
    if (existsSync(gitignorePath)) {
      const content = await readFile(gitignorePath, "utf-8");
      if (!content.includes(dataEntry)) {
        await appendFile(gitignorePath, `\n${dataEntry}\n`);
      }
    } else {
      await writeFile(gitignorePath, `${dataEntry}\n`);
    }
  } catch {
    // Ignore gitignore errors - not critical
  }
}

// =============================================================================
// Storage Error
// =============================================================================

export class StorageError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: {
      path?: string;
      requested?: number;
      available?: number;
      limit?: number;
    }
  ) {
    super(message);
    this.name = "StorageError";
  }
}

// =============================================================================
// Storage Manager Implementation
// =============================================================================

class StorageManagerImpl implements StorageManager {
  readonly root: string;
  private config: StorageConfig;
  private appStateLimit: number;
  private userDataLimit: number;
  private usageCache: StorageUsage | null = null;
  private usageCacheTime = 0;
  private readonly CACHE_TTL = 60000; // 60 seconds

  constructor(root: string, config: StorageConfig = {}) {
    this.root = resolve(root);
    this.config = config;

    // Parse limits
    this.appStateLimit = parseSize(
      config.app_state?.max_size ?? DEFAULT_APP_STATE_MAX
    );
    this.userDataLimit = parseSize(
      config.user_data?.max_size ?? DEFAULT_USER_DATA_MAX
    );
  }

  getAppStatePath(): string {
    return join(this.root, APP_STATE_DIR);
  }

  getUserDataPath(): string {
    return join(this.root, USER_DATA_DIR);
  }

  getConfig(): StorageConfig {
    return this.config;
  }

  async getUsage(): Promise<StorageUsage> {
    const now = Date.now();

    // Return cached value if fresh
    if (this.usageCache && now - this.usageCacheTime < this.CACHE_TTL) {
      return this.usageCache;
    }

    const appStateUsed = await getDirectorySize(this.getAppStatePath());
    const userDataUsed = await getDirectorySize(this.getUserDataPath());

    this.usageCache = {
      appState: {
        used: appStateUsed,
        limit: this.appStateLimit,
        percentage: Math.round((appStateUsed / this.appStateLimit) * 100),
      },
      userData: {
        used: userDataUsed,
        limit: this.userDataLimit,
        percentage: Math.round((userDataUsed / this.userDataLimit) * 100),
      },
    };
    this.usageCacheTime = now;

    return this.usageCache;
  }

  async canWrite(path: string, size: number): Promise<boolean> {
    // Determine which storage area
    const normalizedPath = path.replace(/\\/g, "/");
    const isAppState = normalizedPath.startsWith(APP_STATE_DIR) ||
      normalizedPath.startsWith(`./${APP_STATE_DIR}`) ||
      normalizedPath.startsWith(this.getAppStatePath().replace(/\\/g, "/"));

    const isUserData = normalizedPath.startsWith(USER_DATA_DIR) ||
      normalizedPath.startsWith(`./${USER_DATA_DIR}`) ||
      normalizedPath.startsWith(this.getUserDataPath().replace(/\\/g, "/"));

    if (!isAppState && !isUserData) {
      // Not a storage path, allow
      return true;
    }

    const usage = await this.getUsage();

    if (isAppState) {
      const enabled = this.config.app_state?.enabled ?? true;
      if (!enabled) {
        return false;
      }
      return usage.appState.used + size <= this.appStateLimit;
    }

    if (isUserData) {
      const enabled = this.config.user_data?.enabled ?? true;
      if (!enabled) {
        return false;
      }
      return usage.userData.used + size <= this.userDataLimit;
    }

    return true;
  }

  async clearAppState(): Promise<void> {
    const appStatePath = this.getAppStatePath();

    if (!existsSync(appStatePath)) {
      return;
    }

    // Remove all contents but keep directory
    const entries = await readdir(appStatePath, { withFileTypes: true });
    const { rm } = await import("node:fs/promises");

    for (const entry of entries) {
      const entryPath = join(appStatePath, entry.name);
      await rm(entryPath, { recursive: true, force: true });
    }

    // Invalidate cache
    this.usageCache = null;
  }
}

// =============================================================================
// Initialize Storage
// =============================================================================

/**
 * Initialize storage for a weblet.
 */
export async function initializeStorage(
  root: string,
  manifest: ParsedManifest,
  options: StorageOptions = {}
): Promise<StorageManager> {
  const { createDirs = true, updateGitignore: shouldUpdateGitignore = true } = options;
  const config = manifest.storage ?? {};

  const manager = new StorageManagerImpl(root, config);

  if (createDirs) {
    // Create .data/ if app_state is enabled
    const appStateEnabled = config.app_state?.enabled ?? true;
    if (appStateEnabled) {
      const appStatePath = manager.getAppStatePath();
      if (!existsSync(appStatePath)) {
        await mkdir(appStatePath, { recursive: true });
      }
    }

    // Create .userdata/ if user_data is enabled
    const userDataEnabled = config.user_data?.enabled ?? true;
    if (userDataEnabled) {
      const userDataPath = manager.getUserDataPath();
      if (!existsSync(userDataPath)) {
        await mkdir(userDataPath, { recursive: true });
      }
    }
  }

  // Update .gitignore
  if (shouldUpdateGitignore) {
    await updateGitignore(root);
  }

  return manager;
}

/**
 * Create a storage manager without initializing directories.
 */
export function createStorageManager(
  root: string,
  config: StorageConfig = {}
): StorageManager {
  return new StorageManagerImpl(root, config);
}

// =============================================================================
// Path Validation
// =============================================================================

/**
 * Validate that a path is within storage boundaries (prevent path traversal).
 */
export function validateStoragePath(basePath: string, targetPath: string): boolean {
  const resolvedBase = resolve(basePath);
  const resolvedTarget = resolve(basePath, targetPath);

  return resolvedTarget.startsWith(resolvedBase);
}

/**
 * Assert path is safe, throw if not.
 */
export function assertSafePath(basePath: string, targetPath: string): void {
  if (!validateStoragePath(basePath, targetPath)) {
    throw new StorageError(
      "E-STOR-003",
      `Path must be within storage directory`,
      { path: targetPath }
    );
  }
}

// =============================================================================
// Browser Storage (for runtime: browser)
// =============================================================================

/**
 * Create namespaced browser storage keys.
 */
export function getBrowserStorageKey(appName: string, type: "state" | "data", key: string): string {
  return `weblet:${appName}:${type}:${key}`;
}

/**
 * Browser storage wrapper interface.
 */
export interface BrowserStorage {
  // App state (ephemeral - localStorage)
  getAppState<T>(key: string): T | null;
  setAppState<T>(key: string, value: T): void;
  removeAppState(key: string): void;
  clearAppState(): void;

  // User data (persistent - IndexedDB)
  getUserData<T>(key: string): Promise<T | null>;
  setUserData<T>(key: string, value: T): Promise<void>;
  removeUserData(key: string): Promise<void>;
  listUserData(): Promise<string[]>;
}

/**
 * Create browser storage wrapper (for use in browser environment).
 * This is a factory function that returns code to be included in weblets.
 */
export function createBrowserStorageCode(appName: string): string {
  return `
// Browser Storage for ${appName}
const STORAGE_PREFIX = "weblet:${appName}:";

const webletStorage = {
  // App state (ephemeral - localStorage)
  getAppState(key) {
    const value = localStorage.getItem(STORAGE_PREFIX + "state:" + key);
    return value ? JSON.parse(value) : null;
  },

  setAppState(key, value) {
    localStorage.setItem(STORAGE_PREFIX + "state:" + key, JSON.stringify(value));
  },

  removeAppState(key) {
    localStorage.removeItem(STORAGE_PREFIX + "state:" + key);
  },

  clearAppState() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX + "state:"));
    keys.forEach(k => localStorage.removeItem(k));
  },

  // User data (persistent - IndexedDB)
  async getUserData(key) {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("userdata", "readonly");
      const store = tx.objectStore("userdata");
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value ?? null);
      request.onerror = () => reject(request.error);
    });
  },

  async setUserData(key, value) {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("userdata", "readwrite");
      const store = tx.objectStore("userdata");
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async removeUserData(key) {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("userdata", "readwrite");
      const store = tx.objectStore("userdata");
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async listUserData() {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("userdata", "readonly");
      const store = tx.objectStore("userdata");
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  _db: null,
  async _openDB() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(STORAGE_PREFIX + "db", 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("userdata")) {
          db.createObjectStore("userdata", { keyPath: "key" });
        }
      };
      request.onsuccess = () => {
        this._db = request.result;
        resolve(this._db);
      };
      request.onerror = () => reject(request.error);
    });
  }
};

window.webletStorage = webletStorage;
`.trim();
}
