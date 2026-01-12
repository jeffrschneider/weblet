# Storage Specification

**Spec Version**: 1.0.0
**Weblet Spec Reference**: v1.0.0, Section 8

---

## 1. Overview

Weblets have two distinct storage types: ephemeral app state (`.data/`) for temporary data that can be lost, and persistent user data (`.userdata/`) for data that must survive across sessions. This specification defines how hosts provision, manage, and enforce storage limits for weblets.

---

## 2. Requirements

### 2.1 Functional Requirements

#### Ephemeral Storage (App State)

- **FR-EPHEMERAL-001**: The runtime SHALL create `.data/` directory in weblet root on startup
- **FR-EPHEMERAL-002**: The runtime SHALL allow read/write access to `.data/` from server code
- **FR-EPHEMERAL-003**: The runtime MAY clear `.data/` contents between sessions
- **FR-EPHEMERAL-004**: The runtime SHALL enforce `storage.app_state.max_size` limit
- **FR-EPHEMERAL-005**: The runtime SHALL add `.data/` to .gitignore if not present
- **FR-EPHEMERAL-006**: The `.data/` directory SHALL NOT be included in weblet distribution

#### Persistent Storage (User Data)

- **FR-PERSIST-001**: The runtime SHALL create `.userdata/` directory in weblet root on startup
- **FR-PERSIST-002**: The runtime SHALL preserve `.userdata/` contents across sessions
- **FR-PERSIST-003**: The runtime SHALL enforce `storage.user_data.max_size` limit
- **FR-PERSIST-004**: The runtime SHALL respect `storage.persist` patterns for selective persistence
- **FR-PERSIST-005**: The runtime SHALL provide storage location info to users
- **FR-PERSIST-006**: The runtime SHALL isolate `.userdata/` between different weblets

#### Size Limits

- **FR-SIZE-001**: The runtime SHALL track storage usage per directory
- **FR-SIZE-002**: The runtime SHALL reject writes that exceed configured limits
- **FR-SIZE-003**: The runtime SHALL report current usage via API
- **FR-SIZE-004**: The runtime SHALL support size specifications: bytes, KB, MB, GB

#### Browser Storage (runtime: browser)

- **FR-BROWSER-001**: Browser-only weblets SHALL use localStorage for ephemeral state
- **FR-BROWSER-002**: Browser-only weblets SHALL use IndexedDB for persistent user data
- **FR-BROWSER-003**: Browser storage SHALL be namespaced by weblet name
- **FR-BROWSER-004**: Browser storage SHALL respect same size limits as filesystem storage

### 2.2 Non-Functional Requirements

- **NFR-STORAGE-001**: Storage operations SHALL complete within 100ms for files < 1MB
- **NFR-STORAGE-002**: Storage usage calculation SHALL be cached (recalculated every 60s)
- **NFR-STORAGE-003**: Storage initialization SHALL not block server startup
- **NFR-STORAGE-004**: Storage errors SHALL not crash the weblet server

---

## 3. Interface

### 3.1 APP.md Storage Schema

```yaml
storage:
  app_state:
    enabled: true
    max_size: 10MB        # Default: 10MB

  user_data:
    enabled: true
    max_size: 100MB       # Default: 100MB
    sync: false           # Future: cross-device sync

  persist:                # Patterns for what to persist in .userdata/
    - saves/*
    - preferences.json
    - history.db
```

### 3.2 Storage API (Server-Side)

```typescript
interface StorageManager {
  /**
   * Get ephemeral storage path
   */
  getAppStatePath(): string;  // Returns: ".data/"

  /**
   * Get persistent storage path
   */
  getUserDataPath(): string;  // Returns: ".userdata/"

  /**
   * Check storage usage
   */
  getUsage(): Promise<StorageUsage>;

  /**
   * Check if write would exceed limits
   */
  canWrite(path: string, size: number): Promise<boolean>;

  /**
   * Clean ephemeral storage
   */
  clearAppState(): Promise<void>;
}

interface StorageUsage {
  appState: {
    used: number;     // Bytes
    limit: number;    // Bytes
    percentage: number;
  };
  userData: {
    used: number;
    limit: number;
    percentage: number;
  };
}
```

### 3.3 Storage API (Browser-Side)

```typescript
// utils/storage.ts - Browser storage wrapper

const STORAGE_PREFIX = "weblet:";

interface WebletStorage {
  // App state (ephemeral)
  getAppState<T>(key: string): T | null;
  setAppState<T>(key: string, value: T): void;
  clearAppState(): void;

  // User data (persistent)
  getUserData<T>(key: string): Promise<T | null>;
  setUserData<T>(key: string, value: T): Promise<void>;
  deleteUserData(key: string): Promise<void>;
  listUserData(): Promise<string[]>;
}

function createStorage(appName: string): WebletStorage;
```

### 3.4 Size Parsing

```typescript
function parseSize(size: string): number {
  const match = size.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
  if (!match) throw new Error(`Invalid size: ${size}`);

  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  };

  return Math.floor(value * multipliers[unit]);
}
```

---

## 4. Behavior

### 4.1 Storage Initialization

On weblet startup:

1. Read storage configuration from APP.md
2. Create `.data/` directory if `app_state.enabled` and doesn't exist
3. Create `.userdata/` directory if `user_data.enabled` and doesn't exist
4. Calculate current usage for both directories
5. Log warning if usage exceeds 80% of limit
6. Ensure `.data/` is in .gitignore

### 4.2 Write Enforcement

When a file write is attempted:

1. Determine target directory (`.data/` or `.userdata/`)
2. Get configured limit for that directory
3. Calculate current usage + new file size
4. If exceeds limit:
   - For `.data/`: Return error, suggest clearing cache
   - For `.userdata/`: Return error with usage info
5. If within limit: Allow write

### 4.3 Persist Pattern Matching

The `storage.persist` patterns define what files in `.userdata/` are considered important:

```yaml
persist:
  - saves/*           # All files in saves/ directory
  - preferences.json  # Specific file
  - *.db              # All .db files
```

Patterns use glob syntax. The runtime uses these patterns for:
- Informing users what data is critical
- Future: selective sync, backup prioritization

### 4.4 Browser Storage Mapping

| Server Path | Browser API | Key Pattern |
|-------------|-------------|-------------|
| `.data/*` | localStorage | `weblet:{app}:state:{key}` |
| `.userdata/*` | IndexedDB | Database: `weblet:{app}`, Store: `userdata` |

### 4.5 Storage Cleanup

Ephemeral storage (`.data/`) may be cleared:
- On explicit `clearAppState()` call
- When container/sandbox resets
- When storage limit is approached (LRU eviction)

Persistent storage (`.userdata/`) is only cleared:
- On explicit user action
- On weblet uninstall

---

## 5. Error Handling

| Error Code | Condition | Message |
|------------|-----------|---------|
| E-STOR-001 | Limit exceeded | `Storage limit exceeded: {used}/{limit}` |
| E-STOR-002 | Permission denied | `Cannot write to storage: {path}` |
| E-STOR-003 | Invalid path | `Path must be within storage directory` |
| E-STOR-004 | Storage disabled | `{type} storage is disabled for this weblet` |
| E-STOR-005 | Invalid size format | `Invalid size format: {size}` |
| E-STOR-006 | Browser storage full | `Browser storage quota exceeded` |

### Error Response Format

```typescript
interface StorageError {
  code: string;
  message: string;
  details: {
    path?: string;
    requested?: number;
    available?: number;
    limit?: number;
  };
}
```

---

## 6. Dependencies

- **runtime.spec.md**: Runtime initializes storage on startup
- **cli.spec.md**: CLI may provide storage management commands

---

## 7. Acceptance Criteria

- [ ] AC-001: `.data/` directory is created on first weblet run
- [ ] AC-002: `.userdata/` directory is created on first weblet run
- [ ] AC-003: Files written to `.data/` are readable by server code
- [ ] AC-004: Files written to `.userdata/` persist across restarts
- [ ] AC-005: Writes exceeding `max_size` are rejected with clear error
- [ ] AC-006: Storage usage API returns accurate numbers
- [ ] AC-007: `.data/` is automatically added to .gitignore
- [ ] AC-008: Browser storage works with localStorage/IndexedDB
- [ ] AC-009: Storage is isolated between different weblets
- [ ] AC-010: Size limits support KB, MB, GB units

---

## 8. Test Scenarios

### TS-STOR-001: Ephemeral Storage Creation
```
Given a new weblet with app_state.enabled: true
When I run the weblet for the first time
Then .data/ directory exists
And it is writable
```

### TS-STOR-002: Persistent Storage Creation
```
Given a new weblet with user_data.enabled: true
When I run the weblet for the first time
Then .userdata/ directory exists
And it is writable
```

### TS-STOR-003: Data Persistence Across Restarts
```
Given a running weblet
When I write "test" to .userdata/test.txt
And I restart the weblet
Then .userdata/test.txt still contains "test"
```

### TS-STOR-004: Ephemeral Data May Be Cleared
```
Given a weblet with data in .data/
When the storage manager clears app state
Then .data/ is empty
And the weblet continues to function
```

### TS-STOR-005: Size Limit Enforcement
```
Given a weblet with user_data.max_size: 1MB
And .userdata/ contains 900KB of files
When I try to write a 200KB file
Then the write fails with E-STOR-001
And the error includes used/limit info
```

### TS-STOR-006: Size Parsing
```
Given size strings
Then parseSize("10MB") returns 10485760
And parseSize("1GB") returns 1073741824
And parseSize("512KB") returns 524288
And parseSize("100B") returns 100
```

### TS-STOR-007: Gitignore Update
```
Given a weblet without .gitignore
When storage is initialized
Then .gitignore is created
And it contains ".data/"
```

### TS-STOR-008: Gitignore Preservation
```
Given a weblet with existing .gitignore containing "node_modules"
When storage is initialized
Then .gitignore contains both "node_modules" and ".data/"
```

### TS-STOR-009: Browser Storage Namespacing
```
Given two browser-only weblets: "app1" and "app2"
When app1 stores key "foo" with value "bar"
Then app2 reading key "foo" returns null
And app1 reading key "foo" returns "bar"
```

### TS-STOR-010: Storage Usage Reporting
```
Given a weblet with:
  - .data/ containing 5MB
  - user_data.max_size: 100MB
  - .userdata/ containing 20MB
When I call getUsage()
Then appState.used is approximately 5MB
And userData.used is approximately 20MB
And userData.percentage is 20
```

### TS-STOR-011: Path Traversal Prevention
```
Given a weblet with storage enabled
When I try to write to ".userdata/../../../etc/passwd"
Then the write fails with E-STOR-003
And no file is created outside storage directories
```

### TS-STOR-012: Disabled Storage
```
Given a weblet with user_data.enabled: false
When I try to write to .userdata/
Then the write fails with E-STOR-004
And .userdata/ directory does not exist
```
