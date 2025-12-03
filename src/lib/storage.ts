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

    return { userId: deviceId };
  }

  throw new Error('Cannot initialize storage on server-side');
}

