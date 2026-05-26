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
  const [todos, tables] = await Promise.all([getAllTodos(), getAllTableRows()]);

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
  const [todos, tables] = await Promise.all([getAllTodos(), getAllTableRows()]);

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
 *      B. `already_run` — slot-1 is already populated by the user. Their
 *                         slot-1 text is authoritative; delete the legacy
 *                         row, set marker.
 *      C. `migrated`  — legacy has content AND slot-1 is empty. Migrate
 *                       the user's raw legacy bytes (untrimmed) into
 *                       slot-1, delete legacy, set marker. Slot-2/3
 *                       typing from a load-race is preserved.
 */
export async function migratePlaceCharacteristicsRow0(): Promise<PlaceCharRow0MigrationResult> {
  const db = await getDB();
  const tx = db.transaction(['tables', 'metadata'], 'readwrite');
  const tablesStore = tx.objectStore('tables');
  const metadataStore = tx.objectStore('metadata');

  const markerEntry = await metadataStore.get(PLACE_CHARACTERISTICS_ROW0_MIGRATION_MARKER);
  if (markerEntry !== undefined) {
    await tx.done;
    return { status: 'already_run', slotsCopied: 0 };
  }

  const legacyId = `${PLACE_CHARACTERISTICS_ROW0_MODULE_KEY}-${PLACE_CHARACTERISTICS_ROW0_LEGACY_TABLE_ID}-${PLACE_CHARACTERISTICS_ROW0_LEGACY_ROW_ID}`;
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
  const slot1Row = existingSlots.find(
    (r) => r.rowId === PLACE_CHARACTERISTICS_ROW0_TARGET_ROW_ID,
  );
  const slot1Value = (slot1Row?.data as { value?: unknown } | undefined)?.value;
  const slot1HasContent =
    typeof slot1Value === 'string' && slot1Value.trim().length > 0;

  const now = new Date().toISOString();
  const targetId = `${PLACE_CHARACTERISTICS_ROW0_MODULE_KEY}-${PLACE_CHARACTERISTICS_ROW0_MERGED_TABLE_ID}-${PLACE_CHARACTERISTICS_ROW0_TARGET_ROW_ID}`;

  // CASE B — slot-1 is already populated. User has typed directly into
  // slot-1 post-PR-B; their value is authoritative and we must not
  // overwrite it. Delete the legacy row anyway so DataTable does not
  // double-render the workbook prompt. The user's slot-1 text wins; the
  // legacy bytes are released (they chose to retype rather than wait for
  // migration). Slot-2/3 typing is preserved (we don't touch them).
  if (slot1HasContent) {
    await tablesStore.delete(legacyId);
    await metadataStore.put({
      key: PLACE_CHARACTERISTICS_ROW0_MIGRATION_MARKER,
      value: now,
      updatedAt: now,
    });
    await tx.done;
    return { status: 'already_run', slotsCopied: 0 };
  }

  // CASE C — slot-1 is empty (slot-2 or slot-3 may be populated from a
  // race where the user typed before migration completed). Migrate the
  // legacy bytes into slot-1 — slot-1 was empty so this is non-destructive,
  // and the user's slot-2/3 typing is preserved. Delete the legacy source
  // row to prevent double-render.
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

  return { status: 'migrated', slotsCopied: 1 };
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
    await getDB();

    // Idempotent on every load — gated on a metadata marker. Failure to
    // migrate must not break startup; existing UI continues to work even
    // if a user-data merge gets skipped.
    try {
      await migrateSeniorsAndDisabilities();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[Storage] seniors-and-disabilities migration failed:', err);
      }
    }

    try {
      await migratePlaceCharacteristicsRow0();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[Storage] place-characteristics-row-0 migration failed:', err);
      }
    }

    return { userId: deviceId };
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

