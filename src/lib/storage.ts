/**
 * IndexedDB Storage - Local-Only Data Persistence
 *
 * This module implements the local storage layer using IndexedDB.
 * All user data is stored locally on the device.
 *
 * ## Why IndexedDB vs localStorage?
 * - localStorage has 5-10MB limit, IndexedDB has no practical limit
 * - localStorage is synchronous (blocks UI), IndexedDB is async
 * - IndexedDB supports indexes for efficient queries
 * - IndexedDB supports transactions for data consistency
 *
 * ## Data Model:
 * - **todos**: Checkbox completion state and notes (keyed by `moduleKey-todoId`)
 * - **tables**: Editable table rows with custom data (keyed by `moduleKey-tableId-rowId`)
 * - **metadata**: App settings and preferences
 *
 * ## Key Design Decisions:
 * - Composite keys (e.g., `${moduleKey}-${todoId}`) allow per-module queries
 * - Indexes enable efficient lookups (by-module, by-table)
 * - Schema version 1 (will increment for migrations)
 * - All data stays local - no cloud sync
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import '@/lib/asset-rev'; // re-hash the shared storage chunk past the 2026-06-07 Cloudflare asset-poisoning incident (additive only; no logic/data change)
import { replayEditJournal } from '@/lib/edit-journal';
import { rowHasWork } from '@/lib/work-predicate';

/**
 * IndexedDB schema definition
 *
 * Defines three object stores with their keys, values, and indexes.
 */
type MetadataValue = string | number | boolean | null | string[] | Record<string, unknown>;

// Runtime type guards for metadata values (replaces unsafe `as` casts)
function isString(v: unknown): v is string {
  return typeof v === 'string';
}
function isNumber(v: unknown): v is number {
  return typeof v === 'number' && !Number.isNaN(v);
}
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === 'string');
}

interface ResilienceDB extends DBSchema {
  /** Todo/checklist completion tracking */
  todos: {
    key: string; // Composite key: `${moduleKey}-${todoId}`
    value: {
      id: string; // Same as key (required for keyPath)
      moduleKey: string; // Module identifier (e.g., "emergency-preparedness")
      todoId: string; // Todo item identifier
      completed: boolean; // Completion state
      completedAt?: string; // ISO timestamp when completed
      notes?: string; // Optional user notes
    };
    indexes: { 'by-module': string }; // Index for querying all todos in a module
  };
  /** Editable table row data */
  tables: {
    key: string; // Composite key: `${moduleKey}-${tableId}-${rowId}`
    value: {
      id: string; // Same as key (required for keyPath)
      moduleKey: string; // Module identifier
      tableId: string; // Table identifier within module
      rowId: string; // Row identifier (generated)
      data: Record<string, string>; // Column data as key-value pairs
      updatedAt: string; // ISO timestamp of last local update
    };
    indexes: { 'by-table': [string, string] }; // Compound index: [moduleKey, tableId]
  };
  /** App metadata and settings */
  metadata: {
    key: string; // Setting key (e.g., "activeHubId", "lastSyncTime")
    value: {
      key: string; // Same as key (required for keyPath)
      value: MetadataValue; // Setting value
      updatedAt: string; // ISO timestamp of last update
    };
  };
}

let dbInstance: IDBPDatabase<ResilienceDB> | null = null;

/**
 * Initialize or retrieve IndexedDB connection
 *
 * Opens the 'resilience-toolkit' database (version 1) and creates object stores
 * with indexes if this is the first time opening or upgrading.
 *
 * ## Schema Migrations:
 * - Version 1: Initial schema with todos, tables, metadata stores
 * - Future versions: Increment version number and add migration logic in upgrade callback
 *
 * ## Indexes Created:
 * - `todos.by-module`: Allows efficient queries like "get all todos for this module"
 * - `tables.by-table`: Compound index for queries like "get all rows for this table"
 *
 * @returns {Promise<IDBPDatabase>} Database connection (singleton)
 */
async function getDB(): Promise<IDBPDatabase<ResilienceDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<ResilienceDB>('resilience-toolkit', 1, {
    upgrade(db) {
      // Todos store: Checklist completion state
      const todoStore = db.createObjectStore('todos', { keyPath: 'id' });
      todoStore.createIndex('by-module', 'moduleKey');

      // Tables store: Editable table rows
      const tableStore = db.createObjectStore('tables', { keyPath: 'id' });
      tableStore.createIndex('by-table', ['moduleKey', 'tableId']);

      // Metadata store: App settings and state
      db.createObjectStore('metadata', { keyPath: 'key' });
    },
  });

  return dbInstance;
}

// ============================================================================
// TODO OPERATIONS
// ============================================================================

export interface Todo {
  id: string;
  moduleKey: string;
  todoId: string;
  completed: boolean;
  completedAt?: string;
  notes?: string;
}

/**
 * Get a specific todo
 */
export async function getTodo(moduleKey: string, todoId: string): Promise<Todo | undefined> {
  const db = await getDB();
  const id = `${moduleKey}-${todoId}`;
  return await db.get('todos', id);
}

/**
 * Get all todos for a module
 */
export async function getModuleTodos(moduleKey: string): Promise<Todo[]> {
  const db = await getDB();
  return await db.getAllFromIndex('todos', 'by-module', moduleKey);
}

/**
 * Save or update a todo
 */
export async function saveTodo(todo: Omit<Todo, 'id'>): Promise<void> {
  const db = await getDB();
  const id = `${todo.moduleKey}-${todo.todoId}`;
  await db.put('todos', { ...todo, id });
  await noteUserWrite(1, [todo.moduleKey]);
}

/**
 * Toggle todo completion
 */
export async function toggleTodo(moduleKey: string, todoId: string): Promise<boolean> {
  const todo = await getTodo(moduleKey, todoId);
  const completed = !todo?.completed;

  await saveTodo({
    moduleKey,
    todoId,
    completed,
    completedAt: completed ? new Date().toISOString() : undefined,
    notes: todo?.notes,
  });

  return completed;
}

/**
 * Update todo note
 */
export async function updateTodoNote(
  moduleKey: string,
  todoId: string,
  note: string
): Promise<void> {
  const todo = await getTodo(moduleKey, todoId);

  await saveTodo({
    moduleKey,
    todoId,
    completed: todo?.completed ?? false,
    completedAt: todo?.completedAt,
    notes: note || undefined, // Don't save empty strings
  });
}

/**
 * Delete a todo
 */
export async function deleteTodo(moduleKey: string, todoId: string): Promise<void> {
  const db = await getDB();
  const id = `${moduleKey}-${todoId}`;
  await db.delete('todos', id);
  await noteUserWrite(1, [moduleKey]);
}

// ============================================================================
// TABLE OPERATIONS
// ============================================================================

export interface TableRow {
  id: string;
  moduleKey: string;
  tableId: string;
  rowId: string;
  data: Record<string, string>;
  updatedAt: string;
}

/**
 * Get a specific table row
 */
export async function getTableRow(
  moduleKey: string,
  tableId: string,
  rowId: string
): Promise<TableRow | undefined> {
  const db = await getDB();
  const id = `${moduleKey}-${tableId}-${rowId}`;
  return await db.get('tables', id);
}

/**
 * Get all rows for a table
 */
export async function getTableRows(moduleKey: string, tableId: string): Promise<TableRow[]> {
  const db = await getDB();
  return await db.getAllFromIndex('tables', 'by-table', [moduleKey, tableId]);
}

/**
 * Save or update a table row
 */
export async function saveTableRow(row: Omit<TableRow, 'id' | 'updatedAt'>): Promise<void> {
  const db = await getDB();
  const id = `${row.moduleKey}-${row.tableId}-${row.rowId}`;
  await db.put('tables', {
    ...row,
    id,
    updatedAt: new Date().toISOString(),
  });
  await noteUserWrite(1, [row.moduleKey]);
}

/**
 * Delete a table row
 */
export async function deleteTableRow(
  moduleKey: string,
  tableId: string,
  rowId: string
): Promise<void> {
  const db = await getDB();
  const id = `${moduleKey}-${tableId}-${rowId}`;
  await db.delete('tables', id);
  await noteUserWrite(1, [moduleKey]);
}

// ============================================================================
// FORM OPERATIONS (PlanForm — single-record key-value forms)
// ============================================================================
// NOTE: Form rows use data: { value: string } while DataTable rows use
// data: { col1: string, col2: string, ... }. Both share the tables store.
// CSV export is per-DataTable; PlanForm uses HTML export. The JSON
// export/import round-trip preserves both shapes because it serializes
// raw IDB records. Do not add CSV export to PlanForm without handling
// the encoding difference.

/**
 * Save or update a single form field.
 * Wraps saveTableRow using the tables store with rowId=fieldKey, data={value}.
 */
export async function saveFormField(
  moduleKey: string,
  formId: string,
  fieldKey: string,
  value: string
): Promise<void> {
  await saveTableRow({ moduleKey, tableId: formId, rowId: fieldKey, data: { value } });
}

/**
 * Load all form fields for a single form as a key-value Record.
 */
export async function getFormData(
  moduleKey: string,
  formId: string
): Promise<Record<string, string>> {
  const rows = await getTableRows(moduleKey, formId);
  const data: Record<string, string> = {};
  for (const row of rows) {
    data[row.rowId] = row.data.value ?? '';
  }
  return data;
}

// ============================================================================
// METADATA OPERATIONS
// ============================================================================

/**
 * Get metadata value
 */
export async function getMetadata(key: string): Promise<MetadataValue | undefined> {
  const db = await getDB();
  const result = await db.get('metadata', key);
  return result?.value;
}

/**
 * Set metadata value
 */
export async function setMetadata(key: string, value: MetadataValue): Promise<void> {
  const db = await getDB();
  await db.put('metadata', {
    key,
    value,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Delete a metadata entry. Useful for resetting one-shot flags (e.g., migration markers).
 */
export async function deleteMetadata(key: string): Promise<void> {
  const db = await getDB();
  await db.delete('metadata', key);
}

// ============================================================================
// BACKUP CUE PRIMITIVES (work-based cue; see backup-cue.ts for the read side)
// ============================================================================

/**
 * The unprotected-work write counter (metadata store, persist-protected).
 * Personal-class: local safety instrumentation, never synced or surfaced as a
 * per-person metric. Reset to 0 only by a completed backup's baseline record;
 * ABSENT means unknown (cold start) and increments never invent a number from
 * absence, so an existing user's pre-ship work is never painted as "1 change".
 */
export const BACKUP_WRITE_COUNTER_KEY = 'backupWriteCounter';

/** Last completed backup timestamp (ISO), in the persist-protected metadata store. */
export const LAST_BACKUP_AT_KEY = 'lastBackupAt';

/** Canonical work-snapshot hash recorded at the last completed backup. */
export const LAST_BACKUP_HASH_KEY = 'lastBackupHash';

/**
 * The has-work canary, deliberately in localStorage: its divergent survival
 * versus IndexedDB (canary says work existed, stores are empty) is the
 * loss-detected signal. Value is a small JSON map of the moduleKeys that have
 * ever held user work, so a loss report can name what was there (DR6).
 */
export const HAS_WORK_CANARY_KEY = 'rt-has-work';

/** Mark the canary for a set of moduleKeys. Sync, cheap, never throws. */
function markHasWorkCanary(moduleKeys: string[]): void {
  if (moduleKeys.length === 0) return;
  try {
    let modules: Record<string, boolean> = {};
    const raw = localStorage.getItem(HAS_WORK_CANARY_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.modules && typeof parsed.modules === 'object') {
          modules = parsed.modules;
        }
      } catch {
        // corrupt canary: rewrite it fresh
      }
    }
    let changed = false;
    for (const key of moduleKeys) {
      if (!modules[key]) {
        modules[key] = true;
        changed = true;
      }
    }
    if (changed || !raw) {
      localStorage.setItem(
        HAS_WORK_CANARY_KEY,
        JSON.stringify({ modules, updatedAt: new Date().toISOString() }),
      );
    }
  } catch {
    // localStorage unavailable; the canary is best-effort by design
  }
}

/**
 * Record that user work landed: mark the has-work canary and bump the write
 * counter. Called ONLY from the leaf writers (and the load-time journal-replay
 * call site), never from generic setMetadata — diagnostics writes must not
 * self-count. An absent counter stays absent (cold-start unknown); a failure
 * never breaks the save it follows.
 */
async function noteUserWrite(count: number, moduleKeys: string[]): Promise<void> {
  markHasWorkCanary(moduleKeys);
  if (count <= 0) return;
  try {
    const db = await getDB();
    const existing = await db.get('metadata', BACKUP_WRITE_COUNTER_KEY);
    const current = existing?.value;
    if (typeof current === 'number' && !Number.isNaN(current)) {
      await db.put('metadata', {
        key: BACKUP_WRITE_COUNTER_KEY,
        value: current + count,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch {
    // Never break a user save over cue accounting. The cue read side maps a
    // failed counter read to "unknown", which claims the cue (fails honest).
  }
}


// ============================================================================
// EXPORT OPERATIONS
// ============================================================================

/**
 * Export all data for a module
 */
export async function getModuleData(modulePath: string): Promise<{
  todos: Todo[];
  tables: Record<string, TableRow[]>;
}> {
  // Extract module key from path
  const moduleKey = modulePath.split('/').pop()?.replace('.mdx', '') || '';

  const todos = await getModuleTodos(moduleKey);

  // Get all unique table IDs for this module
  const db = await getDB();
  const allTableRows = await db.getAllFromIndex('tables', 'by-table');
  const moduleTableRows = allTableRows.filter((row) =>
    row.id.startsWith(`${moduleKey}-`)
  );

  // Group by table ID
  const tables: Record<string, TableRow[]> = {};
  moduleTableRows.forEach((row) => {
    if (!tables[row.tableId]) {
      tables[row.tableId] = [];
    }
    tables[row.tableId].push(row);
  });

  return { todos, tables };
}

/**
 * Export all data
 */
export async function exportAllData(): Promise<{
  todos: Todo[];
  tables: TableRow[];
  metadata: Record<string, MetadataValue>;
}> {
  const db = await getDB();

  const todos = await db.getAll('todos');
  const tables = await db.getAll('tables');
  const metadataArray = await db.getAll('metadata');

  const metadata: Record<string, MetadataValue> = {};
  metadataArray.forEach((item) => {
    metadata[item.key] = item.value;
  });

  return { todos, tables, metadata };
}

/**
 * Validate and import data from a JSON export file.
 * Uses a multi-store IDB transaction — if any write fails, the entire import rolls back.
 *
 * @throws Error with specific message for invalid JSON, wrong schema, or transaction failure
 */
export async function importAllData(data: unknown): Promise<{ todosImported: number; tablesImported: number }> {
  // Validate top-level structure
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid format: expected a JSON object');
  }

  const obj = data as Record<string, unknown>;

  if (!Array.isArray(obj.todos) || !Array.isArray(obj.tables)) {
    throw new Error('Wrong schema: missing "todos" or "tables" arrays');
  }

  const todos = obj.todos as Record<string, unknown>[];
  const tables = obj.tables as Record<string, unknown>[];

  // Validate required fields on todos
  for (const todo of todos) {
    if (!todo.moduleKey || !todo.id) {
      throw new Error('Wrong schema: todo items must have "moduleKey" and "id" fields');
    }
  }

  // Validate required fields on tables
  for (const table of tables) {
    if (!table.moduleKey || !table.tableId || !table.rowId) {
      throw new Error('Wrong schema: table items must have "moduleKey", "tableId", and "rowId" fields');
    }
  }

  const db = await getDB();

  // Use a multi-store transaction for atomicity
  const tx = db.transaction(['todos', 'tables', 'metadata'], 'readwrite');

  try {
    // Clear existing data
    await tx.objectStore('todos').clear();
    await tx.objectStore('tables').clear();

    // Import todos
    const todoStore = tx.objectStore('todos');
    for (const todo of todos) {
      await todoStore.put(todo as unknown as ResilienceDB['todos']['value']);
    }

    // Import tables
    const tableStore = tx.objectStore('tables');
    for (const table of tables) {
      await tableStore.put(table as unknown as ResilienceDB['tables']['value']);
    }

    // Import metadata if present
    const metadataStore = tx.objectStore('metadata');
    if (obj.metadata && typeof obj.metadata === 'object' && !Array.isArray(obj.metadata)) {
      const metadata = obj.metadata as Record<string, unknown>;
      for (const [key, value] of Object.entries(metadata)) {
        await metadataStore.put({
          key,
          value: value as MetadataValue,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // The imported snapshot may carry a stale or malformed migration
    // marker (e.g., set on an older device that had `no_data` and is now
    // about to import old-key todos). Clear all migration markers so the
    // next initializeStorage re-evaluates against the imported state.
    for (const markerKey of MIGRATION_MARKER_KEYS) {
      await metadataStore.delete(markerKey);
    }

    await tx.done;
    return { todosImported: todos.length, tablesImported: tables.length };
  } catch (error) {
    // Transaction automatically rolls back on error
    throw new Error(`Import failed: ${error instanceof Error ? error.message : 'transaction error'}`);
  }
}

// ============================================================================
// CHECKLIST OPERATIONS (use existing todos store)
// ============================================================================

/**
 * Get checklist items for a specific section
 * Note: Checklist items are stored in the 'todos' store
 */
export async function getChecklistItems(
  moduleKey: string,
  sectionId?: string
): Promise<Todo[]> {
  const todos = await getModuleTodos(moduleKey);

  if (!sectionId) {
    return todos;
  }

  // Filter by section if sectionId is provided (matches pattern: sectionId-itemId)
  return todos.filter((todo) => todo.todoId.startsWith(`${sectionId}-`));
}

/**
 * Get checklist completion statistics for a module or section
 */
export async function getChecklistStats(
  moduleKey: string,
  sectionId?: string
): Promise<{
  total: number;
  completed: number;
  percentage: number;
}> {
  const items = await getChecklistItems(moduleKey, sectionId);
  const completed = items.filter((item) => item.completed).length;
  const total = items.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { total, completed, percentage };
}

/**
 * Batch update multiple checklist items using a single transaction for atomicity.
 */
export async function batchUpdateChecklistItems(
  updates: Array<{
    moduleKey: string;
    todoId: string;
    completed: boolean;
  }>
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('todos', 'readwrite');
  const store = tx.objectStore('todos');

  for (const update of updates) {
    const id = `${update.moduleKey}-${update.todoId}`;
    const existing = await store.get(id);
    await store.put({
      id,
      moduleKey: update.moduleKey,
      todoId: update.todoId,
      completed: update.completed,
      completedAt: update.completed ? new Date().toISOString() : undefined,
      notes: existing?.notes,
    });
  }

  await tx.done;
  await noteUserWrite(
    updates.length,
    Array.from(new Set(updates.map((u) => u.moduleKey))),
  );
}

/**
 * Clear all completed items for a module or section using a single transaction.
 */
export async function clearCompletedItems(
  moduleKey: string,
  sectionId?: string
): Promise<number> {
  const items = await getChecklistItems(moduleKey, sectionId);
  const completedItems = items.filter((item) => item.completed);

  if (completedItems.length === 0) return 0;

  const db = await getDB();
  const tx = db.transaction('todos', 'readwrite');
  const store = tx.objectStore('todos');

  for (const item of completedItems) {
    const id = `${item.moduleKey}-${item.todoId}`;
    await store.delete(id);
  }

  await tx.done;
  await noteUserWrite(completedItems.length, [moduleKey]);
  return completedItems.length;
}

// ============================================================================
// DASHBOARD AGGREGATION OPERATIONS
// ============================================================================

/**
 * Get all todos across all modules
 * Used for dashboard aggregation
 */
export async function getAllTodos(): Promise<Todo[]> {
  const db = await getDB();
  return await db.getAll('todos');
}

/**
 * Get all table rows across all modules
 * Used for dashboard aggregation
 */
export async function getAllTableRows(): Promise<TableRow[]> {
  const db = await getDB();
  return await db.getAll('tables');
}

/**
 * Activity item representing a user action
 */
export interface ActivityItem {
  type: 'todo_completed' | 'table_edited';
  moduleKey: string;
  itemId: string;
  timestamp: string;
}

/**
 * Get recent activity items sorted by timestamp
 * Combines completed todos and edited tables
 *
 * @param limit Maximum number of items to return (default 10)
 */
export async function getRecentActivity(limit: number = 10): Promise<ActivityItem[]> {
  const [todos, tables] = await Promise.all([getAllTodos(), getAllTableRows()]);

  const activities: ActivityItem[] = [];

  // Add completed todos with timestamps
  todos
    .filter((todo) => todo.completed && todo.completedAt)
    .forEach((todo) => {
      activities.push({
        type: 'todo_completed',
        moduleKey: todo.moduleKey,
        itemId: todo.todoId,
        timestamp: todo.completedAt!,
      });
    });

  // Add recently edited table rows
  tables.forEach((row) => {
    activities.push({
      type: 'table_edited',
      moduleKey: row.moduleKey,
      itemId: `${row.tableId}-${row.rowId}`,
      timestamp: row.updatedAt,
    });
  });

  // Sort by timestamp descending and limit
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/**
 * Overall statistics across all modules
 */
export interface OverallStats {
  totalTodos: number;
  completedTodos: number;
  completionPercentage: number;
  totalTableRows: number;
  modulesStarted: number;
  lastActivityDate: string | null;
}

/**
 * Get aggregated statistics across all modules
 */
export async function getOverallStats(): Promise<OverallStats> {
  const [todos, allTables] = await Promise.all([getAllTodos(), getAllTableRows()]);
  // Blank template/scaffold rows are not saved work — filter them out before
  // deriving anything, so totalTableRows, modulesStarted, and lastActivityDate
  // all count only rows with a filled input column.
  const tables = allTables.filter(rowHasWork);

  const completedTodos = todos.filter((t) => t.completed).length;
  const uniqueModules = new Set([
    ...todos.map((t) => t.moduleKey),
    ...tables.map((t) => t.moduleKey),
  ]);

  // Find most recent activity
  const allDates = [
    ...todos.filter((t) => t.completedAt).map((t) => t.completedAt!),
    ...tables.map((t) => t.updatedAt),
  ];
  const lastActivityDate =
    allDates.length > 0
      ? allDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : null;

  return {
    totalTodos: todos.length,
    completedTodos,
    completionPercentage:
      todos.length > 0 ? Math.round((completedTodos / todos.length) * 100) : 0,
    totalTableRows: tables.length,
    modulesStarted: uniqueModules.size,
    lastActivityDate,
  };
}

/**
 * Progress data for a single module
 */
export interface ModuleProgress {
  moduleKey: string;
  displayName: string;
  totalTodos: number;
  completedTodos: number;
  percentage: number;
  tableRowCount: number;
  lastActivity: string | null;
}

/**
 * Module display names mapping
 * Maps moduleKey to human-readable names
 */
const MODULE_DISPLAY_NAMES: Record<string, string> = {
  'emergency-preparedness': 'Emergency Preparedness',
  'emergency-preparedness-kits': 'Emergency Kits',
  'food-and-water': 'Food & Water',
  'first-aid-medical': 'Medical Supplies',
  'power-supply': 'Power & Energy',
  'warming-cooling-shelter': 'Shelter',
  'vehicles-equipment': 'Vehicles',
  'sanitation-hygiene': 'Sanitation',
  'children-disaster': 'Special Populations',
  'senior-citizens': 'Special Populations',
  'people-with-disabilities': 'Special Populations',
  'lep-populations': 'Special Populations',
  'farm-animals': 'Special Populations',
  'flood-recovery': 'Flood Recovery',
  'mutual-aid': 'Mutual Aid',
  'knowing-your-community': 'Knowing Your Community',
  'knowing-community': 'Knowing Your Community',
  'bringing-people-together': 'Knowing Your Community',
  'baseline-resilience': 'Baseline Resilience',
  'basic-needs': 'Basic Needs',
  'shared-tools': 'Shared Tools',
  'community-building': 'Community Building',
  'community-emergency-response': 'Community Emergency Response',
};

/**
 * Human display name for a moduleKey (shared by the progress views and the
 * dashboard work meter, so the two can never disagree on a module's name).
 */
export function getModuleDisplayName(key: string): string {
  return MODULE_DISPLAY_NAMES[key] || formatModuleKey(key);
}

/**
 * Format module key to display name
 */
function formatModuleKey(key: string): string {
  return key
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get progress breakdown by module
 * Returns array sorted by completion percentage (descending)
 */
export async function getModuleProgress(): Promise<ModuleProgress[]> {
  const [todos, allTables] = await Promise.all([getAllTodos(), getAllTableRows()]);
  // Blank template/scaffold rows are not saved work — filter them out before
  // grouping, so module inclusion, tableRowCount, and per-module lastActivity
  // all count only rows with a filled input column.
  const tables = allTables.filter(rowHasWork);

  // Group by moduleKey
  const moduleMap = new Map<
    string,
    {
      todos: Todo[];
      tables: TableRow[];
    }
  >();

  todos.forEach((todo) => {
    if (!moduleMap.has(todo.moduleKey)) {
      moduleMap.set(todo.moduleKey, { todos: [], tables: [] });
    }
    moduleMap.get(todo.moduleKey)!.todos.push(todo);
  });

  tables.forEach((table) => {
    if (!moduleMap.has(table.moduleKey)) {
      moduleMap.set(table.moduleKey, { todos: [], tables: [] });
    }
    moduleMap.get(table.moduleKey)!.tables.push(table);
  });

  // Convert to array of ModuleProgress
  const progress: ModuleProgress[] = [];

  moduleMap.forEach((data, moduleKey) => {
    const completed = data.todos.filter((t) => t.completed).length;
    const total = data.todos.length;

    // Find last activity for this module
    const moduleDates = [
      ...data.todos.filter((t) => t.completedAt).map((t) => t.completedAt!),
      ...data.tables.map((t) => t.updatedAt),
    ];
    const lastActivity =
      moduleDates.length > 0
        ? moduleDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
        : null;

    progress.push({
      moduleKey,
      displayName: MODULE_DISPLAY_NAMES[moduleKey] || formatModuleKey(moduleKey),
      totalTodos: total,
      completedTodos: completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      tableRowCount: data.tables.length,
      lastActivity,
    });
  });

  // Sort by percentage descending, then by name
  return progress.sort((a, b) => {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    return a.displayName.localeCompare(b.displayName);
  });
}

// ============================================================================
// STREAK & GOAL TRACKING
// ============================================================================

/**
 * Streak data for tracking consecutive days of activity
 */
export interface StreakData {
  currentStreak: number;
  lastActivityDate: string | null;
}

/**
 * Get current streak data
 */
export async function getStreakData(): Promise<StreakData> {
  const rawStreak = await getMetadata('currentStreak');
  const currentStreak = isNumber(rawStreak) ? rawStreak : 0;
  const rawDate = await getMetadata('streakLastActivityDate');
  const lastActivityDate = isString(rawDate) ? rawDate : null;
  return { currentStreak, lastActivityDate };
}

/**
 * Update streak when user completes an activity
 * Call this when a todo is completed
 */
export async function updateStreak(): Promise<StreakData> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const { currentStreak, lastActivityDate } = await getStreakData();

  if (lastActivityDate === today) {
    // Already counted today
    return { currentStreak, lastActivityDate };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let newStreak: number;
  if (lastActivityDate === yesterdayStr) {
    // Consecutive day - increment streak
    newStreak = currentStreak + 1;
  } else {
    // Streak broken or first activity - start at 1
    newStreak = 1;
  }

  await setMetadata('currentStreak', newStreak);
  await setMetadata('streakLastActivityDate', today);

  return { currentStreak: newStreak, lastActivityDate: today };
}

/**
 * Weekly progress data
 */
export interface WeeklyProgress {
  completed: number;
  goal: number;
  weekStartDate: string;
}

/**
 * Get the Monday of the current week
 */
function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

/**
 * Get weekly progress data
 */
export async function getWeeklyProgress(): Promise<WeeklyProgress> {
  const currentWeekStart = getCurrentWeekStart();
  const rawWeekStart = await getMetadata('weekStartDate');
  const storedWeekStart = isString(rawWeekStart) ? rawWeekStart : null;
  const rawGoal = await getMetadata('weeklyGoal');
  const goal = isNumber(rawGoal) ? rawGoal : 5; // Default goal: 5 items

  // Reset if we're in a new week
  if (storedWeekStart !== currentWeekStart) {
    await setMetadata('weekStartDate', currentWeekStart);
    await setMetadata('weeklyCompleted', 0);
    return { completed: 0, goal, weekStartDate: currentWeekStart };
  }

  const rawCompleted = await getMetadata('weeklyCompleted');
  const completed = isNumber(rawCompleted) ? rawCompleted : 0;
  return { completed, goal, weekStartDate: currentWeekStart };
}

/**
 * Increment weekly completed count
 * Call this when a todo is completed
 */
export async function incrementWeeklyProgress(): Promise<WeeklyProgress> {
  const progress = await getWeeklyProgress();
  const newCompleted = progress.completed + 1;
  await setMetadata('weeklyCompleted', newCompleted);
  return { ...progress, completed: newCompleted };
}

/**
 * Set weekly goal
 */
export async function setWeeklyGoal(goal: number): Promise<void> {
  await setMetadata('weeklyGoal', Math.max(1, goal)); // Minimum goal of 1
}

// ============================================================================
// BOOKMARKED MODULES
// ============================================================================

/**
 * Get list of bookmarked module keys
 */
export async function getBookmarkedModules(): Promise<string[]> {
  const raw = await getMetadata('bookmarkedModules');
  return isStringArray(raw) ? raw : [];
}

/**
 * Toggle bookmark for a module
 * @returns true if now bookmarked, false if unbookmarked
 */
export async function toggleBookmark(moduleKey: string): Promise<boolean> {
  const bookmarks = await getBookmarkedModules();
  const index = bookmarks.indexOf(moduleKey);

  if (index === -1) {
    // Add bookmark
    bookmarks.push(moduleKey);
    await setMetadata('bookmarkedModules', bookmarks);
    return true;
  } else {
    // Remove bookmark
    bookmarks.splice(index, 1);
    await setMetadata('bookmarkedModules', bookmarks);
    return false;
  }
}

// ============================================================================
// PERSONAL NOTES
// ============================================================================

/**
 * Get personal notes
 */
export async function getPersonalNotes(): Promise<string> {
  const raw = await getMetadata('personalNotes');
  return isString(raw) ? raw : '';
}

/**
 * Save personal notes
 */
export async function savePersonalNotes(notes: string): Promise<void> {
  await setMetadata('personalNotes', notes);
  // Increment lives HERE, at the leaf, never in generic setMetadata: the
  // diagnostics and cue writes that also pass through setMetadata must not
  // self-count as unprotected work.
  await noteUserWrite(1, ['personal-notes']);
}

// ============================================================================
// MIGRATIONS
// ============================================================================

/**
 * seniors-and-disabilities consolidation (1-8 Populations with Specific Needs).
 *
 * The site previously split a single workbook section into two h3 sections
 * with separate moduleKeys (`senior-citizens`, `people-with-disabilities`).
 * Day-21 (PR `feat/step1a-priority-ep`) re-merged the section under a new
 * canonical moduleKey `seniors-and-disabilities`. Without this migration,
 * any check-state a user recorded under the old keys becomes orphaned —
 * still in IndexedDB, but never read by the new UI.
 *
 * Contract:
 * - Idempotent: a successful run sets a metadata marker. Subsequent loads
 *   short-circuit when no old-key data remains. When sources DO remain
 *   (post-import re-seed, missing-marker-after-import), the migration
 *   re-runs and writes only the todoIds whose merged-key target does
 *   not yet exist.
 * - Target authoritative: once a `seniors-and-disabilities-${todoId}`
 *   record exists, it represents the user's most recent intent and the
 *   migration will NEVER overwrite it. A user who unchecks an item on
 *   the merged key after migration keeps that uncheck on every reload.
 *   Known limitation (same root cause): writes on deprecated keys that
 *   land AFTER the merged-key target was created — whether from a stale
 *   tab still running pre-day-21 code, or imported as part of a snapshot
 *   from a partially-migrated device — are orphaned on the deprecated
 *   key. They remain forensically recoverable (the deprecated key data
 *   is preserved verbatim) but do not surface in the active UI. Without
 *   a per-todo `updatedAt` field on the todos schema, there is no way
 *   to distinguish post-migration drift from pre-migration legacy data,
 *   so we err toward preserving the user's most recent merged-key edit.
 *   Mitigation path (out of scope for day-22): make `saveTodo` redirect
 *   deprecated keys onto the canonical merged key, plus a per-todo
 *   `updatedAt` to drive cross-key delta detection.
 * - Lossless on initial migration: source todos under old keys are NOT
 *   deleted. They remain readable until the deprecated allowlist is
 *   dropped (planned: 2 minor versions past the migration ship). The
 *   first-time merge is note-preserving: when multiple uncompleted
 *   entries carry distinct notes, the migration concatenates them
 *   rather than dropping one.
 * - Collision-safe: when the same `todoId` exists under both old keys
 *   (e.g., `senior-directory`) the winning entry is selected
 *   deterministically — see `pickMigrationWinner` and `mergeWinner`.
 * - Atomic: the per-todo source reads, target writes, and marker write all
 *   run in a single readwrite transaction. A failure mid-flight rolls back;
 *   the marker is only set on success, so a partial run simply re-runs.
 * - Stable-state cheap: reloads on a fully-migrated device run two index
 *   reads and exit without opening a readwrite tx.
 */

const SENIORS_AND_DISABILITIES_MERGED_KEY = 'seniors-and-disabilities';
const SENIORS_AND_DISABILITIES_DEPRECATED_KEYS = [
  'senior-citizens',
  'people-with-disabilities',
] as const;
const SENIORS_AND_DISABILITIES_MIGRATION_MARKER = 'migration_seniors_and_disabilities_v1';
const MIGRATION_NOTES_SEPARATOR = '\n\n---\n\n';

// 0-1 place-characteristics row-0 slot-substrate restore (workbook p10 "1: 2: 3:" enumeration).
// Legacy free-text row-0 under tableId="place-characteristics" lifts to slot-1 under the
// isolated tableId="place-characteristics-row-0-slots". Legacy record stays readable
// (orphan-discipline, forensic recovery — same shape as seniors).
const PLACE_CHARACTERISTICS_ROW0_MIGRATION_MARKER = 'migration_place_characteristics_row_0_slots_v1';
const PLACE_CHARACTERISTICS_ROW0_MODULE_KEY = 'knowing-community';
const PLACE_CHARACTERISTICS_ROW0_LEGACY_TABLE_ID = 'place-characteristics';
const PLACE_CHARACTERISTICS_ROW0_LEGACY_ROW_ID = 'row-0';
const PLACE_CHARACTERISTICS_ROW0_LEGACY_FIELD = 'Your Response';
const PLACE_CHARACTERISTICS_ROW0_MERGED_TABLE_ID = 'place-characteristics-row-0-slots';
const PLACE_CHARACTERISTICS_ROW0_TARGET_ROW_ID = 'slot-1';

/**
 * Markers that gate one-shot migrations. Cleared on `importAllData` so an
 * imported snapshot always re-evaluates against current code, regardless
 * of which device produced the export.
 */
const MIGRATION_MARKER_KEYS = [
  SENIORS_AND_DISABILITIES_MIGRATION_MARKER,
  PLACE_CHARACTERISTICS_ROW0_MIGRATION_MARKER,
] as const;

/**
 * moduleKeys whose data is preserved (readable) but no longer wired into
 * the UI. New writes to these keys should be considered a bug — the .astro
 * pages render under canonical post-migration moduleKeys instead.
 *
 * Removal policy: keep readable for at least 2 minor releases past the
 * day-22 migration commit, then drop after a sweep confirms no live data
 * loss risk.
 */
export const DEPRECATED_MODULE_KEYS: ReadonlySet<string> = new Set(
  SENIORS_AND_DISABILITIES_DEPRECATED_KEYS,
);

export function isDeprecatedModuleKey(moduleKey: string): boolean {
  return DEPRECATED_MODULE_KEYS.has(moduleKey);
}

/**
 * Pick the primary entry between two competing todos. Used as the binary
 * reducer; `mergeWinner` then layers note-preservation on top.
 *
 * Priority:
 *   1. A completed entry beats an uncompleted one — never silently uncheck.
 *   2. Among two completed entries, the later `completedAt` wins
 *      (post-merge edits beat pre-merge state).
 *   3. Among two uncompleted entries, the one with notes wins.
 *   4. Final fallback: lexicographic on `moduleKey` for determinism
 *      ('people-with-disabilities' < 'senior-citizens' < 'seniors-and-disabilities').
 */
function pickMigrationWinner(a: Todo, b: Todo): Todo {
  if (a.completed !== b.completed) {
    return a.completed ? a : b;
  }

  if (a.completed && b.completed) {
    const ta = a.completedAt ?? '';
    const tb = b.completedAt ?? '';
    if (ta > tb) return a;
    if (tb > ta) return b;
  }

  const aHasNotes = !!(a.notes && a.notes.length > 0);
  const bHasNotes = !!(b.notes && b.notes.length > 0);
  if (aHasNotes !== bHasNotes) {
    return aHasNotes ? a : b;
  }

  return a.moduleKey <= b.moduleKey ? a : b;
}

/**
 * Choose the winning todo state across N candidates and preserve notes
 * that would otherwise be silently dropped.
 *
 * Selection rules:
 * - Primary state (`completed`, `completedAt`, `id`) follows
 *   `pickMigrationWinner` — completed beats uncompleted, later
 *   `completedAt` wins, then notes-present, then lexicographic moduleKey.
 * - Notes are preserved from EVERY candidate that contributes a unique
 *   note (after whitespace trim). When the primary is completed and the
 *   secondary candidate is not, the secondary's note is still merged in
 *   — the user's check stays, AND the related uncompleted-side note
 *   survives. This is the only branch where the returned record is
 *   synthesized rather than one of the inputs verbatim.
 * - Whitespace-only note differences are deduped via `.trim()` for the
 *   uniqueness comparison; the original (untrimmed) text is preserved
 *   in the concatenated output.
 */
function mergeWinner(candidates: Todo[]): Todo {
  const primary = candidates.reduce(pickMigrationWinner);

  const seenTrimmed = new Set<string>();
  const distinctNotes: string[] = [];
  const primaryTrimmed = (primary.notes ?? '').trim();
  if (primaryTrimmed) {
    seenTrimmed.add(primaryTrimmed);
  }
  for (const c of candidates) {
    if (c === primary) continue;
    const notes = c.notes;
    if (!notes) continue;
    const trimmed = notes.trim();
    if (!trimmed) continue;
    if (seenTrimmed.has(trimmed)) continue;
    seenTrimmed.add(trimmed);
    distinctNotes.push(notes);
  }

  if (distinctNotes.length === 0) {
    return primary;
  }

  const primaryHasNotes = !!(primary.notes && primary.notes.length > 0);
  const merged = primaryHasNotes
    ? [primary.notes!, ...distinctNotes].join(MIGRATION_NOTES_SEPARATOR)
    : distinctNotes.join(MIGRATION_NOTES_SEPARATOR);
  return { ...primary, notes: merged };
}

export interface SeniorsAndDisabilitiesMigrationResult {
  status: 'already_run' | 'migrated' | 'no_data';
  todosCopied: number;
  collisions: number;
}

/**
 * Run the seniors-and-disabilities consolidation migration.
 *
 * Strategy:
 *   1. Read-only fast path. If the marker is set AND no old-key data
 *      exists, return `already_run` without opening a readwrite tx.
 *      Stable post-migration loads pay only two index reads.
 *   2. If old-key data exists, open a readwrite tx and re-read sources
 *      INSIDE it — closing the TOCTOU race against another tab writing
 *      between our pre-check and our writes.
 *   3. For each `todoId`, merge candidate state (including any pre-existing
 *      merged-key entry) via `mergeWinner` and skip the put when the
 *      target already matches the winner — keeping repeat loads zero-write.
 *   4. Set the marker only if there was data to migrate. Fresh devices
 *      with no old-key data return `no_data` and DO NOT set the marker,
 *      so a future import that brings old-key data in will still trigger
 *      a real migration pass.
 */
export async function migrateSeniorsAndDisabilities(): Promise<SeniorsAndDisabilitiesMigrationResult> {
  const markerValue = await getMetadata(SENIORS_AND_DISABILITIES_MIGRATION_MARKER);
  const hasMarker = markerValue !== undefined;

  const preCheckSourcesPerKey: Todo[][] = await Promise.all(
    SENIORS_AND_DISABILITIES_DEPRECATED_KEYS.map((key) => getModuleTodos(key)),
  );
  const preCheckSources = preCheckSourcesPerKey.flat();

  if (preCheckSources.length === 0) {
    if (hasMarker) {
      return { status: 'already_run', todosCopied: 0, collisions: 0 };
    }
    // Fresh device with no old-key data. Intentionally do NOT set the
    // marker — a later `importAllData` that brings old-key data in must
    // still get a real migration pass.
    return { status: 'no_data', todosCopied: 0, collisions: 0 };
  }

  // Source data exists. Open a readwrite tx and re-read inside it so the
  // collision merge is atomic with respect to old-key writes from any
  // other tab.
  const db = await getDB();
  const tx = db.transaction(['todos', 'metadata'], 'readwrite');
  const todoStore = tx.objectStore('todos');
  const metadataStore = tx.objectStore('metadata');
  const byModuleIndex = todoStore.index('by-module');

  const sources: Todo[] = [];
  for (const moduleKey of SENIORS_AND_DISABILITIES_DEPRECATED_KEYS) {
    const fromKey = await byModuleIndex.getAll(moduleKey);
    sources.push(...fromKey);
  }

  if (sources.length === 0) {
    // Race: pre-check saw rows but the tx-internal read didn't. Close
    // out with no writes; the next load will re-evaluate.
    await tx.done;
    return { status: 'already_run', todosCopied: 0, collisions: 0 };
  }

  const byTodoId = new Map<string, Todo[]>();
  for (const todo of sources) {
    const list = byTodoId.get(todo.todoId);
    if (list) {
      list.push(todo);
    } else {
      byTodoId.set(todo.todoId, [todo]);
    }
  }

  let todosCopied = 0;
  let collisions = 0;
  const now = new Date().toISOString();

  for (const [todoId, candidates] of byTodoId) {
    const targetId = `${SENIORS_AND_DISABILITIES_MERGED_KEY}-${todoId}`;
    const existingTarget = await todoStore.get(targetId);

    if (existingTarget) {
      // Target wins. The merged-key record is the user's authoritative
      // post-migration state — never overwrite it from deprecated keys.
      // This preserves post-migration unchecks, edits, and note changes
      // even when the deprecated keys still hold the pre-merge state.
      continue;
    }

    // First-time merge for this todoId. Cross-old-key duplicates count
    // as collisions.
    if (candidates.length > 1) {
      collisions++;
    }

    const winner = mergeWinner(candidates);
    await todoStore.put({
      id: targetId,
      moduleKey: SENIORS_AND_DISABILITIES_MERGED_KEY,
      todoId,
      completed: winner.completed,
      completedAt: winner.completedAt,
      notes: winner.notes,
    });
    todosCopied++;
  }

  await metadataStore.put({
    key: SENIORS_AND_DISABILITIES_MIGRATION_MARKER,
    value: now,
    updatedAt: now,
  });

  await tx.done;

  // A migration that landed writes is a post-backup data reshape: count it
  // once so the cue can never show false calm over reshaped work.
  if (todosCopied > 0) {
    await noteUserWrite(1, [SENIORS_AND_DISABILITIES_MERGED_KEY]);
  }

  // Status is derived from the work this tx actually did, NOT from the
  // pre-tx `hasMarker` snapshot. Concurrent tabs can both pass the
  // pre-check with `hasMarker === false`, get serialized by IDB, and
  // each return — we want the second tab to report `already_run` once
  // the first has populated the merged key, not a misleading `migrated`.
  return {
    status: todosCopied > 0 ? 'migrated' : 'already_run',
    todosCopied,
    collisions,
  };
}

/**
 * Result of the place-characteristics row-0 slot-substrate restore.
 *
 * `status`:
 *   - `migrated`     — legacy row-0 free-text was lifted to slot-1 and the
 *                      source row was deleted in the same transaction.
 *   - `already_run`  — marker present OR user has already populated at least
 *                      one slot under the new SlotCollection (target-authoritative).
 *   - `no_data`      — no legacy text to lift; marker NOT set so a future
 *                      `importAllData` that brings legacy data in still
 *                      triggers a real migration (codex P1 #1 regression
 *                      precedent).
 */
export interface PlaceCharRow0MigrationResult {
  status: 'already_run' | 'migrated' | 'no_data';
  slotsCopied: number;
}

/**
 * Restore the workbook p10 "1: 2: 3:" 3-slot enumeration that was authored on
 * row-0 of the place-characteristics DataTable. The legacy single free-text
 * "Your Response" cell becomes slot-1 of a SlotCollection under an isolated
 * tableId; slots 2 and 3 start empty so the user can complete the workbook's
 * counted enumeration.
 *
 * Source: TableRow at (knowing-community, place-characteristics, row-0)
 *   data: { "Prompt": "...", "Your Response": "<user text>" }
 * Target: TableRow at (knowing-community, place-characteristics-row-0-slots, slot-1)
 *   data: { value: "<user text>" }
 *
 * Discipline:
 *   1. All reads, the existence check, the writes, and the source-row
 *      delete happen in a single `readwrite` IndexedDB transaction on
 *      (tables, metadata) so concurrent tabs cannot race between the
 *      slot-existence check and the slot-1 write.
 *   2. Marker short-circuit (any non-undefined value counts as already-set,
 *      defending against malformed imports with non-string markers).
 *   3. The legacy source row is ALWAYS deleted when it exists in any shape
 *      (whitespace, malformed, or migrated). This prevents DataTable's
 *      namespace-scoped `getTableRows` from surfacing a stale or ghost row
 *      below the SlotCollection. The migrated user bytes live in slot-1
 *      from this point forward; slot-1 IS the canonical recovery point.
 *   4. Three cases:
 *      A. `no_data`   — no migrate-able legacy content (absent, malformed,
 *                       or whitespace-only). If row exists, delete it.
 *                       Marker stays UNSET so a late-arriving import with
 *                       real legacy text re-triggers a real migration pass.
 *      B. `already_run` — ANY valid slot row (slot-1, slot-2, or slot-3)
 *                         exists in any shape (including { value: '' }).
 *                         Existence proves the user has engaged with the
 *                         SlotCollection, so the legacy single-cell row-0 is
 *                         superseded; injecting it would resurrect stale data
 *                         (a deliberately-cleared slot, or slot-2/3 present
 *                         without slot-1 after a marker-clearing import).
 *                         Delete the legacy row, set marker; leave slots as-is.
 *      C. `migrated`  — legacy has content AND no slots exist yet (fresh
 *                       upgrader). Migrate the user's raw legacy bytes
 *                       (untrimmed) into slot-1, delete legacy, set marker.
 */
export async function migratePlaceCharacteristicsRow0(): Promise<PlaceCharRow0MigrationResult> {
  const db = await getDB();
  const tx = db.transaction(['tables', 'metadata'], 'readwrite');
  const tablesStore = tx.objectStore('tables');
  const metadataStore = tx.objectStore('metadata');

  const legacyId = `${PLACE_CHARACTERISTICS_ROW0_MODULE_KEY}-${PLACE_CHARACTERISTICS_ROW0_LEGACY_TABLE_ID}-${PLACE_CHARACTERISTICS_ROW0_LEGACY_ROW_ID}`;

  const markerEntry = await metadataStore.get(PLACE_CHARACTERISTICS_ROW0_MIGRATION_MARKER);
  if (markerEntry !== undefined) {
    // Migration already ran. We do NOT sweep a lingering row-0 here: the
    // resurrection race that motivated such a sweep (a sibling DataTable
    // hydrating a stale row-0 before the migration deleted it) is closed at
    // the source — DataTable.loadData now awaits initializeStorage() before
    // reading, so it reads post-migration state and never renders row-0.
    // A blind sweep would risk deleting a row-0 that holds divergent,
    // un-recovered content (codex round-7 P1), so it is intentionally absent.
    await tx.done;
    return { status: 'already_run', slotsCopied: 0 };
  }

  const legacyRow = await tablesStore.get(legacyId);
  const legacyExists = legacyRow !== undefined;
  const legacyData = legacyRow?.data as Record<string, unknown> | undefined;
  const legacyRaw = legacyData?.[PLACE_CHARACTERISTICS_ROW0_LEGACY_FIELD];
  const legacyValue = typeof legacyRaw === 'string' ? legacyRaw : '';
  const legacyHasContent = legacyValue.trim().length > 0;

  // CASE A — no migrate-able legacy content. Includes: row absent, row
  // present but malformed (missing/non-string "Your Response"), row present
  // but whitespace-only. If the row exists in ANY shape, delete it so
  // DataTable's namespace-scoped getTableRows does not surface a ghost
  // row alongside row-1/2/3 below the SlotCollection. Marker stays unset
  // so a late-arriving import with real legacy text re-triggers migration.
  if (!legacyHasContent) {
    if (legacyExists) {
      await tablesStore.delete(legacyId);
    }
    await tx.done;
    return { status: 'no_data', slotsCopied: 0 };
  }

  const existingSlots = await tablesStore
    .index('by-table')
    .getAll([PLACE_CHARACTERISTICS_ROW0_MODULE_KEY, PLACE_CHARACTERISTICS_ROW0_MERGED_TABLE_ID]);
  // The existence of ANY valid slot row (slot-1, slot-2, or slot-3) is
  // authoritative: it proves the user has engaged with the new SlotCollection,
  // so the legacy single-cell row-0 is superseded. Injecting legacy bytes here
  // would resurrect stale data — e.g. a deliberately-cleared slot-1
  // ({ value: '' }), or slot-2/slot-3 present without slot-1 after an import
  // that cleared the marker alongside a re-imported legacy row-0 (codex
  // round-9 P1). Checking only slot-1 missed the slot-2/3-without-slot-1 case.
  const hasAnySlot = existingSlots.some((r) => /^slot-\d+$/.test(r.rowId));

  const now = new Date().toISOString();
  const targetId = `${PLACE_CHARACTERISTICS_ROW0_MODULE_KEY}-${PLACE_CHARACTERISTICS_ROW0_MERGED_TABLE_ID}-${PLACE_CHARACTERISTICS_ROW0_TARGET_ROW_ID}`;

  // CASE B — the SlotCollection already holds saved state (any slot-N row).
  // The user has engaged with it, so the legacy row-0 is superseded and must
  // NOT be injected. Release the legacy row (delete it so DataTable does not
  // double-render the workbook prompt) and record the migration as run. Any
  // existing slot content (1/2/3) is left untouched.
  if (hasAnySlot) {
    await tablesStore.delete(legacyId);
    await metadataStore.put({
      key: PLACE_CHARACTERISTICS_ROW0_MIGRATION_MARKER,
      value: now,
      updatedAt: now,
    });
    await tx.done;
    return { status: 'already_run', slotsCopied: 0 };
  }

  // CASE C — no slots exist yet: a fresh upgrader who has never touched the
  // SlotCollection. Recover the legacy bytes into slot-1 (non-destructive —
  // the table is empty). Delete the legacy source row to prevent double-render.
  await tablesStore.put({
    id: targetId,
    moduleKey: PLACE_CHARACTERISTICS_ROW0_MODULE_KEY,
    tableId: PLACE_CHARACTERISTICS_ROW0_MERGED_TABLE_ID,
    rowId: PLACE_CHARACTERISTICS_ROW0_TARGET_ROW_ID,
    data: { value: legacyValue },
    updatedAt: now,
  });
  await tablesStore.delete(legacyId);
  await metadataStore.put({
    key: PLACE_CHARACTERISTICS_ROW0_MIGRATION_MARKER,
    value: now,
    updatedAt: now,
  });
  await tx.done;

  // Same rule as the seniors migration: a landed reshape counts once, so a
  // post-backup migration can never leave a false-calm cue behind.
  await noteUserWrite(1, [PLACE_CHARACTERISTICS_ROW0_MODULE_KEY]);

  return { status: 'migrated', slotsCopied: 1 };
}

// ============================================================================
// PERSISTENT STORAGE (durability floor)
// ============================================================================

/**
 * One-shot marker: set once persist() has been requested, so we never ask the
 * browser more than once (some browsers prompt). The grant boolean is still
 * re-read on every load.
 */
export const PERSIST_REQUESTED_MARKER = 'storage_persist_requested_v1';

export interface PersistResult {
  /** True only on the call that actually invoked persist() (once per device). */
  requested: boolean;
  /** The current navigator.storage.persisted() grant boolean. */
  persisted: boolean;
  /** Whether the Storage persistence API is available at all. */
  supported: boolean;
}

/**
 * Request durable, eviction-resistant storage for this origin — the fix for
 * the most insidious "came back, all blank" loss (best-effort IndexedDB is
 * evicted under storage pressure and by WebKit's 7-day rule). We call
 * `navigator.storage.persist()` exactly once (marker-gated) and re-read
 * `persisted()` on every load to keep the health signal current.
 *
 * We also record the grant boolean, the deviceId, and a diagnostic breadcrumb
 * into the metadata store (which persist() protects) rather than localStorage
 * or the edit journal (both evictable) — so the breadcrumb survives the very
 * eviction it exists to diagnose (ED1). We drive UI off the boolean only and
 * never surface `estimate()` quota numbers (browsers deliberately fuzz them).
 */
export async function requestPersistentStorage(deviceId: string): Promise<PersistResult> {
  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.storage &&
    typeof navigator.storage.persist === 'function';

  let persisted = false;
  let requested = false;

  if (supported) {
    const alreadyRequested = (await getMetadata(PERSIST_REQUESTED_MARKER)) !== undefined;
    if (!alreadyRequested) {
      // First real init on this device: ask ONCE, then set the marker even if
      // denied. Firefox shows a permission prompt on every persist() call, so
      // retrying on each load would nag; the tradeoff is that an origin that
      // becomes eligible later is not auto-upgraded (the eng-lock DoD is
      // request/record/warn, not persisted()===true). The health banner keeps
      // warning while persisted() stays false.
      try {
        persisted = await navigator.storage.persist();
      } catch {
        persisted = false;
      }
      requested = true;
      await setMetadata(PERSIST_REQUESTED_MARKER, new Date().toISOString());
    } else {
      // Already asked; just re-read the current grant.
      try {
        persisted =
          typeof navigator.storage.persisted === 'function'
            ? await navigator.storage.persisted()
            : false;
      } catch {
        persisted = false;
      }
    }
  }

  // Record the health signal + diagnostic breadcrumb into the (protected)
  // metadata store. Written in all cases so a loss report always has a
  // breadcrumb, even where the persistence API is absent.
  try {
    await setMetadata('storagePersisted', persisted);
    await setMetadata('storageDeviceId', deviceId);
    await setMetadata('storageDiagnostic', {
      persisted,
      supported,
      deviceId,
      lastCheck: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    });
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[Storage] failed to record persist diagnostic:', err);
    }
  }

  // Nudge the app-wide StorageHealthBanner to re-check now that the grant is
  // recorded. On first load the banner (client:idle) can read persisted()=false
  // before this resolves; without this it would linger on a stale "at-risk"
  // warning until the next visibilitychange. Event name mirrors
  // storageHealth.ts STORAGE_HEALTH_EVENT, kept literal to avoid a
  // storage <-> storageHealth import cycle.
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('rt-storage-health-changed'));
  }

  return { requested, persisted, supported };
}

/**
 * Flush the synchronous edit journal into IndexedDB on demand. Used before a
 * backup export so pending, not-yet-persisted keystrokes are included in the
 * downloaded file. Reconciles by updatedAt exactly like the load-time replay.
 */
export async function flushEditJournalToStorage(): Promise<void> {
  const db = await getDB();
  await replayEditJournal(db);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize storage for local-only mode
 *
 * Generates and persists a unique device ID in localStorage for tracking purposes.
 * Also runs any one-shot data migrations the app currently owns.
 *
 * @returns {Promise<{userId: string}>} Device ID
 */
export async function initializeStorage(): Promise<{
  userId: string;
  /**
   * True only if every one-shot data migration completed (success OR a
   * conclusive no-op). False if any migration threw. We still swallow the
   * error so app startup is never broken (BaseLayout depends on this), but
   * we SURFACE the outcome so callers that hydrate migrated data — e.g.
   * SlotCollection — can refuse to enable editing until migrations are
   * known-complete. Without this, a transient migration failure would let a
   * user type into an empty slot and clobber un-recovered legacy bytes when
   * the migration retries on the next load (codex round-5 P1 #2).
   */
  migrationsOk: boolean;
  /**
   * Per-migration success flags, keyed by migration name. A data-hydrating
   * caller should gate on the SPECIFIC migration its data depends on (e.g.
   * SlotCollection gates on `placeCharacteristicsRow0`) rather than the
   * global migrationsOk, so an unrelated migration's failure does not
   * needlessly disable an otherwise-healthy component (codex round-6 P2).
   */
  migrations: Record<string, boolean>;
}> {
  if (typeof window !== 'undefined') {
    let deviceId = localStorage.getItem('deviceId');

    if (!deviceId) {
      // Generate new device ID
      deviceId = `device-${crypto.randomUUID()}`;
      localStorage.setItem('deviceId', deviceId);
      if (import.meta.env.DEV) {
        console.log('[Storage] Generated new device ID:', deviceId);
      }
    }

    // Pre-warm the database connection so components don't pay the cost
    const db = await getDB();

    // Request eviction-resistant storage once (marker-gated) and record the
    // grant + a diagnostic breadcrumb into the protected metadata store. Never
    // break startup on failure.
    try {
      await requestPersistentStorage(deviceId);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[Storage] persist request failed:', err);
      }
    }

    // Replay the synchronous edit journal into IndexedDB BEFORE anything reads
    // rows. This recovers edits that were typed but never flushed (tab closed
    // during the debounce window — the exact loss this floor fixes). Replay is
    // idempotent, reconciles by updatedAt, and respects deletes; a failure must
    // not break startup, so it is swallowed like the migrations below.
    try {
      const replay = await replayEditJournal(db);
      // A keystroke that only reached the journal before tab close is still
      // unprotected work: count the rows the load-time replay landed. The
      // backup's own pre-export flush (flushEditJournalToStorage) deliberately
      // does NOT count — this call site is the only counting replay.
      const landed = replay.recovered + replay.deleted;
      if (landed > 0) {
        await noteUserWrite(landed, []);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[Storage] edit-journal replay failed:', err);
      }
    }

    // Idempotent on every load — gated on a metadata marker. Failure to
    // migrate must not break startup; existing UI continues to work even
    // if a user-data merge gets skipped. We record (but do not throw on)
    // each migration's outcome so data-hydrating callers can gate on the
    // specific migration they depend on.
    const migrations: Record<string, boolean> = {};

    try {
      await migrateSeniorsAndDisabilities();
      migrations.seniorsAndDisabilities = true;
    } catch (err) {
      migrations.seniorsAndDisabilities = false;
      if (import.meta.env.DEV) {
        console.error('[Storage] seniors-and-disabilities migration failed:', err);
      }
    }

    try {
      await migratePlaceCharacteristicsRow0();
      migrations.placeCharacteristicsRow0 = true;
    } catch (err) {
      migrations.placeCharacteristicsRow0 = false;
      if (import.meta.env.DEV) {
        console.error('[Storage] place-characteristics-row-0 migration failed:', err);
      }
    }

    const migrationsOk = Object.values(migrations).every(Boolean);

    return { userId: deviceId, migrationsOk, migrations };
  }

  throw new Error('Cannot initialize storage on server-side');
}

// ============================================================================
// DIAGNOSTICS
// ============================================================================

/**
 * Verify storage health - checks DB connection, stores, and record counts.
 * Can be called from browser console via `debugStorage.healthCheck()`
 * or used in automated tests.
 */
export async function verifyStorage(): Promise<{
  status: 'healthy' | 'error';
  deviceId: string | null;
  dbVersion: number;
  stores: string[];
  counts: { todos: number; tables: number; metadata: number };
  error?: string;
}> {
  try {
    const db = await getDB();
    const [todos, tables, metadata] = await Promise.all([
      db.count('todos'),
      db.count('tables'),
      db.count('metadata'),
    ]);
    return {
      status: 'healthy',
      deviceId: localStorage.getItem('deviceId'),
      dbVersion: db.version,
      stores: Array.from(db.objectStoreNames),
      counts: { todos, tables, metadata },
    };
  } catch (error) {
    return {
      status: 'error',
      deviceId: localStorage.getItem('deviceId'),
      dbVersion: 0,
      stores: [],
      counts: { todos: 0, tables: 0, metadata: 0 },
      error: String(error),
    };
  }
}

