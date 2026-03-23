/**
 * Storage Layer Unit Tests
 *
 * Tests IndexedDB operations using fake-indexeddb to simulate the browser API
 * in a Node.js environment. Covers todo CRUD, table row operations,
 * metadata, diagnostics, and concurrent access patterns.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// fake-indexeddb polyfills indexedDB globally, so storage.ts can use it
import {
  initializeStorage,
  getTodo,
  saveTodo,
  toggleTodo,
  updateTodoNote,
  deleteTodo,
  getModuleTodos,
  getTableRow,
  getTableRows,
  saveTableRow,
  deleteTableRow,
  getMetadata,
  setMetadata,
  verifyStorage,
  exportAllData,
  importAllData,
  getChecklistItems,
  getChecklistStats,
  batchUpdateChecklistItems,
  clearCompletedItems,
} from './storage';

// Reset localStorage between tests. We don't reset IndexedDB between tests
// because the module-level singleton `dbInstance` in storage.ts retains
// the connection. Instead, tests use unique moduleKeys/todoIds to avoid
// cross-test interference.
beforeEach(() => {
  localStorage.clear();
});

describe('initializeStorage', () => {
  it('should generate a device ID on first call', async () => {
    const result = await initializeStorage();
    expect(result.userId).toMatch(/^device-/);
    expect(localStorage.getItem('deviceId')).toBe(result.userId);
  });

  it('should reuse existing device ID on subsequent calls', async () => {
    const first = await initializeStorage();
    const second = await initializeStorage();
    expect(first.userId).toBe(second.userId);
  });
});

describe('Todo Operations', () => {
  it('should save and retrieve a todo', async () => {
    await saveTodo({
      moduleKey: 'test-module',
      todoId: 'todo-1',
      completed: true,
      completedAt: '2025-01-01T00:00:00.000Z',
    });

    const todo = await getTodo('test-module', 'todo-1');
    expect(todo).toBeDefined();
    expect(todo!.completed).toBe(true);
    expect(todo!.completedAt).toBe('2025-01-01T00:00:00.000Z');
    expect(todo!.moduleKey).toBe('test-module');
    expect(todo!.todoId).toBe('todo-1');
  });

  it('should return undefined for non-existent todo', async () => {
    const todo = await getTodo('nonexistent', 'nope');
    expect(todo).toBeUndefined();
  });

  it('should toggle todo completion state', async () => {
    // First toggle: unchecked → checked
    const completed = await toggleTodo('test-module', 'toggle-1');
    expect(completed).toBe(true);

    const todo = await getTodo('test-module', 'toggle-1');
    expect(todo!.completed).toBe(true);
    expect(todo!.completedAt).toBeDefined();

    // Second toggle: checked → unchecked
    const uncompleted = await toggleTodo('test-module', 'toggle-1');
    expect(uncompleted).toBe(false);

    const updated = await getTodo('test-module', 'toggle-1');
    expect(updated!.completed).toBe(false);
    expect(updated!.completedAt).toBeUndefined();
  });

  it('should update todo notes', async () => {
    // Create todo first
    await saveTodo({
      moduleKey: 'test-module',
      todoId: 'note-1',
      completed: false,
    });

    await updateTodoNote('test-module', 'note-1', 'My important note');

    const todo = await getTodo('test-module', 'note-1');
    expect(todo!.notes).toBe('My important note');
  });

  it('should clear empty notes', async () => {
    await saveTodo({
      moduleKey: 'test-module',
      todoId: 'note-2',
      completed: false,
      notes: 'Existing note',
    });

    await updateTodoNote('test-module', 'note-2', '');

    const todo = await getTodo('test-module', 'note-2');
    expect(todo!.notes).toBeUndefined();
  });

  it('should delete a todo', async () => {
    await saveTodo({
      moduleKey: 'test-module',
      todoId: 'delete-me',
      completed: false,
    });

    await deleteTodo('test-module', 'delete-me');
    const todo = await getTodo('test-module', 'delete-me');
    expect(todo).toBeUndefined();
  });

  it('should get all todos for a module', async () => {
    await saveTodo({ moduleKey: 'module-a', todoId: 'item-1', completed: false });
    await saveTodo({ moduleKey: 'module-a', todoId: 'item-2', completed: true });
    await saveTodo({ moduleKey: 'module-b', todoId: 'item-3', completed: false });

    const moduleTodos = await getModuleTodos('module-a');
    expect(moduleTodos).toHaveLength(2);
    expect(moduleTodos.every((t) => t.moduleKey === 'module-a')).toBe(true);
  });
});

describe('Table Operations', () => {
  it('should save and retrieve a table row', async () => {
    await saveTableRow({
      moduleKey: 'knowing-community',
      tableId: 'place-characteristics',
      rowId: 'row-0',
      data: { Prompt: 'What is your town known for?', 'Your Response': 'Mountains' },
    });

    const row = await getTableRow('knowing-community', 'place-characteristics', 'row-0');
    expect(row).toBeDefined();
    expect(row!.data.Prompt).toBe('What is your town known for?');
    expect(row!.data['Your Response']).toBe('Mountains');
    expect(row!.updatedAt).toBeDefined();
  });

  it('should return undefined for non-existent row', async () => {
    const row = await getTableRow('nope', 'nada', 'zilch');
    expect(row).toBeUndefined();
  });

  it('should get all rows for a table', async () => {
    await saveTableRow({
      moduleKey: 'community',
      tableId: 'table-1',
      rowId: 'row-0',
      data: { col: 'a' },
    });
    await saveTableRow({
      moduleKey: 'community',
      tableId: 'table-1',
      rowId: 'row-1',
      data: { col: 'b' },
    });
    await saveTableRow({
      moduleKey: 'community',
      tableId: 'table-2',
      rowId: 'row-0',
      data: { col: 'c' },
    });

    const rows = await getTableRows('community', 'table-1');
    expect(rows).toHaveLength(2);
  });

  it('should delete a table row', async () => {
    await saveTableRow({
      moduleKey: 'community',
      tableId: 'table-1',
      rowId: 'row-0',
      data: { col: 'delete me' },
    });

    await deleteTableRow('community', 'table-1', 'row-0');
    const row = await getTableRow('community', 'table-1', 'row-0');
    expect(row).toBeUndefined();
  });

  it('should update existing row with new timestamp', async () => {
    await saveTableRow({
      moduleKey: 'community',
      tableId: 'table-1',
      rowId: 'row-0',
      data: { col: 'original' },
    });

    const original = await getTableRow('community', 'table-1', 'row-0');

    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));

    await saveTableRow({
      moduleKey: 'community',
      tableId: 'table-1',
      rowId: 'row-0',
      data: { col: 'updated' },
    });

    const updated = await getTableRow('community', 'table-1', 'row-0');
    expect(updated!.data.col).toBe('updated');
    expect(updated!.updatedAt).not.toBe(original!.updatedAt);
  });
});

describe('Metadata Operations', () => {
  it('should set and get metadata', async () => {
    await setMetadata('testKey', 'testValue');
    const value = await getMetadata('testKey');
    expect(value).toBe('testValue');
  });

  it('should return undefined for non-existent metadata', async () => {
    const value = await getMetadata('nonexistent');
    expect(value).toBeUndefined();
  });

  it('should overwrite existing metadata', async () => {
    await setMetadata('key', 'value1');
    await setMetadata('key', 'value2');
    const value = await getMetadata('key');
    expect(value).toBe('value2');
  });

  it('should handle complex metadata values', async () => {
    const complexValue = { nested: { array: [1, 2, 3] } };
    await setMetadata('complex', complexValue);
    const result = await getMetadata('complex');
    expect(result).toEqual(complexValue);
  });
});

describe('Checklist Operations', () => {
  it('should get checklist items filtered by section', async () => {
    await saveTodo({ moduleKey: 'ep-kits', todoId: 'section1-item1', completed: false });
    await saveTodo({ moduleKey: 'ep-kits', todoId: 'section1-item2', completed: true });
    await saveTodo({ moduleKey: 'ep-kits', todoId: 'section2-item1', completed: false });

    const section1Items = await getChecklistItems('ep-kits', 'section1');
    expect(section1Items).toHaveLength(2);

    const allItems = await getChecklistItems('ep-kits');
    expect(allItems).toHaveLength(3);
  });

  it('should calculate checklist stats', async () => {
    await saveTodo({ moduleKey: 'ep-kits', todoId: 's1-a', completed: true });
    await saveTodo({ moduleKey: 'ep-kits', todoId: 's1-b', completed: true });
    await saveTodo({ moduleKey: 'ep-kits', todoId: 's1-c', completed: false });

    const stats = await getChecklistStats('ep-kits', 's1');
    expect(stats.total).toBe(3);
    expect(stats.completed).toBe(2);
    expect(stats.percentage).toBe(67);
  });

  it('should return 0% for empty checklists', async () => {
    const stats = await getChecklistStats('empty-module');
    expect(stats.total).toBe(0);
    expect(stats.completed).toBe(0);
    expect(stats.percentage).toBe(0);
  });

  it('should batch update checklist items', async () => {
    await batchUpdateChecklistItems([
      { moduleKey: 'batch', todoId: 'item-1', completed: true },
      { moduleKey: 'batch', todoId: 'item-2', completed: false },
      { moduleKey: 'batch', todoId: 'item-3', completed: true },
    ]);

    const todos = await getModuleTodos('batch');
    expect(todos).toHaveLength(3);
    expect(todos.filter((t) => t.completed)).toHaveLength(2);
  });

  it('should clear completed items', async () => {
    await saveTodo({ moduleKey: 'clear-test', todoId: 'done-1', completed: true });
    await saveTodo({ moduleKey: 'clear-test', todoId: 'done-2', completed: true });
    await saveTodo({ moduleKey: 'clear-test', todoId: 'pending-1', completed: false });

    const cleared = await clearCompletedItems('clear-test');
    expect(cleared).toBe(2);

    const remaining = await getModuleTodos('clear-test');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].todoId).toBe('pending-1');
  });
});

describe('verifyStorage', () => {
  it('should return healthy status with correct store info', async () => {
    const result = await verifyStorage();
    expect(result.status).toBe('healthy');
    expect(result.dbVersion).toBe(1);
    expect(result.stores).toContain('todos');
    expect(result.stores).toContain('tables');
    expect(result.stores).toContain('metadata');
    expect(result.stores).toHaveLength(3);
  });

  it('should report correct record counts', async () => {
    const before = await verifyStorage();

    await saveTodo({ moduleKey: 'verify-counts', todoId: 'vc-t1', completed: false });
    await saveTodo({ moduleKey: 'verify-counts', todoId: 'vc-t2', completed: true });
    await saveTableRow({ moduleKey: 'verify-counts', tableId: 'tbl', rowId: 'r1', data: {} });
    await setMetadata('verify-counts-key', 'val');

    const after = await verifyStorage();
    expect(after.counts.todos).toBe(before.counts.todos + 2);
    expect(after.counts.tables).toBe(before.counts.tables + 1);
    expect(after.counts.metadata).toBe(before.counts.metadata + 1);
  });
});

describe('exportAllData', () => {
  it('should export all data from all stores', async () => {
    const before = await exportAllData();

    await saveTodo({ moduleKey: 'export-test', todoId: 'exp-1', completed: true });
    await saveTableRow({ moduleKey: 'export-test', tableId: 'tbl', rowId: 'r1', data: { x: 1 } });
    await setMetadata('export-setting', 'value');

    const exported = await exportAllData();
    expect(exported.todos.length).toBe(before.todos.length + 1);
    expect(exported.tables.length).toBe(before.tables.length + 1);
    expect(exported.metadata).toHaveProperty('export-setting', 'value');
  });
});

describe('Concurrent Operations', () => {
  it('should handle concurrent saves without data loss', async () => {
    const promises = Array.from({ length: 20 }, (_, i) =>
      saveTodo({
        moduleKey: 'concurrent-test',
        todoId: `item-${i}`,
        completed: i % 2 === 0,
      })
    );

    await Promise.all(promises);

    const todos = await getModuleTodos('concurrent-test');
    expect(todos).toHaveLength(20);
  });

  it('should handle concurrent reads and writes', async () => {
    // Seed some data
    for (let i = 0; i < 5; i++) {
      await saveTodo({
        moduleKey: 'rw-test',
        todoId: `item-${i}`,
        completed: false,
      });
    }

    // Simultaneous reads and writes
    const operations = [
      getModuleTodos('rw-test'),
      toggleTodo('rw-test', 'item-0'),
      toggleTodo('rw-test', 'item-1'),
      getModuleTodos('rw-test'),
      updateTodoNote('rw-test', 'item-2', 'Note added concurrently'),
    ];

    const results = await Promise.all(operations);

    // Verify data integrity after concurrent ops
    const finalTodos = await getModuleTodos('rw-test');
    expect(finalTodos).toHaveLength(5);

    const item2 = await getTodo('rw-test', 'item-2');
    expect(item2!.notes).toBe('Note added concurrently');
  });
});

describe('importAllData', () => {
  it('should round-trip export and import data', async () => {
    await initializeStorage();

    // Create test data with unique keys
    await saveTodo({ moduleKey: 'import-rt-mod', todoId: 'rt-1', completed: true, completedAt: '2026-01-01T00:00:00Z' });
    await saveTodo({ moduleKey: 'import-rt-mod', todoId: 'rt-2', completed: false });
    await saveTableRow({ moduleKey: 'import-rt-mod', tableId: 'tbl', rowId: 'row1', data: { col: 'val' } });

    // Export
    const exported = await exportAllData();
    expect(exported.todos.length).toBeGreaterThanOrEqual(2);

    // Import the exported data back
    const result = await importAllData(exported);
    expect(result.todosImported).toBeGreaterThanOrEqual(2);
    expect(result.tablesImported).toBeGreaterThanOrEqual(1);

    // Verify data preserved
    const todo1 = await getTodo('import-rt-mod', 'rt-1');
    expect(todo1).not.toBeNull();
    expect(todo1!.completed).toBe(true);
  });

  it('should reject invalid JSON input', async () => {
    await expect(importAllData('not json')).rejects.toThrow('Invalid format');
    await expect(importAllData(null)).rejects.toThrow('Invalid format');
    await expect(importAllData(42)).rejects.toThrow('Invalid format');
  });

  it('should reject data with wrong schema', async () => {
    // Missing todos array
    await expect(importAllData({ tables: [] })).rejects.toThrow('Wrong schema');
    // Missing tables array
    await expect(importAllData({ todos: [] })).rejects.toThrow('Wrong schema');
    // Todo missing required fields
    await expect(importAllData({ todos: [{ foo: 'bar' }], tables: [] })).rejects.toThrow('Wrong schema');
    // Table missing required fields
    await expect(importAllData({ todos: [], tables: [{ moduleKey: 'x' }] })).rejects.toThrow('Wrong schema');
  });

  it('should preserve existing data on schema validation failure', async () => {
    await initializeStorage();

    // Create a todo before the failing import
    await saveTodo({ moduleKey: 'import-preserve', todoId: 'keep-me', completed: true });

    // Attempt import with invalid schema — this should reject before clearing
    await expect(importAllData({ todos: 'not-array', tables: [] })).rejects.toThrow();

    // Verify original data still exists
    const kept = await getTodo('import-preserve', 'keep-me');
    expect(kept).not.toBeNull();
    expect(kept!.completed).toBe(true);
  });

  it('should rollback on mid-transaction IDB error', async () => {
    await initializeStorage();

    // Create a todo before the import attempt
    await saveTodo({ moduleKey: 'import-rollback', todoId: 'survivor', completed: true });

    // Craft a payload that passes schema validation but has a todo missing the
    // required 'id' keyPath — IDB will reject the put() inside the transaction
    const badPayload = {
      todos: [
        { moduleKey: 'x', id: 'x-1', todoId: '1', completed: false },
        { moduleKey: 'y', todoId: '2', completed: false },  // has moduleKey+id check passes, but 'id' is undefined at runtime
      ],
      tables: [],
    };
    // Manually set id to undefined to pass our validation but fail IDB keyPath
    (badPayload.todos[1] as Record<string, unknown>).id = undefined;

    await expect(importAllData(badPayload)).rejects.toThrow();

    // The transaction should have rolled back — original todo preserved
    const survivor = await getTodo('import-rollback', 'survivor');
    expect(survivor).not.toBeNull();
    expect(survivor!.completed).toBe(true);
  });
});
