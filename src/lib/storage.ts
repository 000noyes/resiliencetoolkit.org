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
      data: Record<string, any>; // Column data as key-value pairs
      updatedAt: string; // ISO timestamp of last local update
    };
    indexes: { 'by-table': [string, string] }; // Compound index: [moduleKey, tableId]
  };
  /** App metadata and settings */
  metadata: {
    key: string; // Setting key (e.g., "activeHubId", "lastSyncTime")
    value: {
      key: string; // Same as key (required for keyPath)
      value: any; // Setting value (type varies)
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
  data: Record<string, any>;
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
// METADATA OPERATIONS
// ============================================================================

/**
 * Get metadata value
 */
export async function getMetadata(key: string): Promise<any> {
  const db = await getDB();
  const result = await db.get('metadata', key);
  return result?.value;
}

/**
 * Set metadata value
 */
export async function setMetadata(key: string, value: any): Promise<void> {
  const db = await getDB();
  await db.put('metadata', {
    key,
    value,
    updatedAt: new Date().toISOString(),
  });
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
  metadata: Record<string, any>;
}> {
  const db = await getDB();

  const todos = await db.getAll('todos');
  const tables = await db.getAll('tables');
  const metadataArray = await db.getAll('metadata');

  const metadata: Record<string, any> = {};
  metadataArray.forEach((item) => {
    metadata[item.key] = item.value;
  });

  return { todos, tables, metadata };
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
 * Batch update multiple checklist items
 */
export async function batchUpdateChecklistItems(
  updates: Array<{
    moduleKey: string;
    todoId: string;
    completed: boolean;
  }>
): Promise<void> {
  for (const update of updates) {
    await saveTodo({
      moduleKey: update.moduleKey,
      todoId: update.todoId,
      completed: update.completed,
      completedAt: update.completed ? new Date().toISOString() : undefined,
    });
  }
}

/**
 * Clear all completed items for a module or section
 */
export async function clearCompletedItems(
  moduleKey: string,
  sectionId?: string
): Promise<number> {
  const items = await getChecklistItems(moduleKey, sectionId);
  const completedItems = items.filter((item) => item.completed);

  for (const item of completedItems) {
    await deleteTodo(item.moduleKey, item.todoId);
  }

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
  const currentStreak = (await getMetadata('currentStreak')) ?? 0;
  const lastActivityDate = (await getMetadata('streakLastActivityDate')) ?? null;
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
  const storedWeekStart = (await getMetadata('weekStartDate')) ?? null;
  const goal = (await getMetadata('weeklyGoal')) ?? 5; // Default goal: 5 items

  // Reset if we're in a new week
  if (storedWeekStart !== currentWeekStart) {
    await setMetadata('weekStartDate', currentWeekStart);
    await setMetadata('weeklyCompleted', 0);
    return { completed: 0, goal, weekStartDate: currentWeekStart };
  }

  const completed = (await getMetadata('weeklyCompleted')) ?? 0;
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
  return (await getMetadata('bookmarkedModules')) ?? [];
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
  return (await getMetadata('personalNotes')) ?? '';
}

/**
 * Save personal notes
 */
export async function savePersonalNotes(notes: string): Promise<void> {
  await setMetadata('personalNotes', notes);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize storage for local-only mode
 *
 * Generates and persists a unique device ID in localStorage for tracking purposes.
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
      console.log('[Storage] Generated new device ID:', deviceId);
    }

    // Pre-warm the database connection so components don't pay the cost
    await getDB();

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

