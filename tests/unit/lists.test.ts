import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import Database from "better-sqlite3"
import path from "path"
import fs from "fs"

describe("List Operations", () => {
  let testDbPath: string
  let db: Database.Database

  beforeEach(() => {
    // Create a temporary test database
    testDbPath = path.join(process.cwd(), "data", `test-planner-${Date.now()}.db`)
    db = new Database(testDbPath)
    db.pragma("foreign_keys = ON")
    
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#6366f1',
        emoji TEXT NOT NULL DEFAULT '📋',
        icon TEXT NOT NULL DEFAULT 'List',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_default INTEGER DEFAULT 0
      )
    `)
  })

  afterEach(() => {
    // Clean up test database
    db.close()
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  const createList = (name: string, color: string, emoji: string, icon: string) => {
    const result = db.prepare(`
      INSERT INTO lists (name, color, emoji, icon)
      VALUES (?, ?, ?, ?)
    `).run(name, color, emoji, icon)
    
    return db.prepare('SELECT * FROM lists WHERE id = ?').get(result.lastInsertRowid as number) as any
  }

  const getAllLists = () => {
    return db.prepare('SELECT * FROM lists ORDER BY is_default DESC, name ASC').all()
  }

  const getListById = (id: number) => {
    return db.prepare('SELECT * FROM lists WHERE id = ?').get(id)
  }

  const updateList = (id: number, updates: any) => {
    const fields = Object.keys(updates).filter((key: string) => updates[key] !== undefined)
    if (fields.length === 0) {
      return getListById(id)
    }

    const setClause = fields.map((field: string) => `${field} = ?`).join(', ')
    const values = fields.map((field: string) => updates[field])
    
    db.prepare(`
      UPDATE lists 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(...values, id)
    
    return getListById(id)
  }

  const deleteList = (id: number) => {
    db.prepare('DELETE FROM lists WHERE id = ?').run(id)
  }

  it("should create a new list", () => {
    const list = createList("Test List", "#ff0000", "🔴", "Test")
    expect(list).toBeDefined()
    expect(list.name).toBe("Test List")
    expect(list.color).toBe("#ff0000")
    expect(list.emoji).toBe("🔴")
    expect(list.icon).toBe("Test")
  })

  it("should get all lists", () => {
    createList("List 1", "#ff0000", "🔴", "Test")
    createList("List 2", "#00ff00", "🟢", "Test")
    
    const lists = getAllLists()
    expect(lists.length).toBeGreaterThanOrEqual(2)
  })

  it("should get a list by id", () => {
    const createdList = createList("Test List", "#ff0000", "🔴", "Test") as any
    const retrievedList = getListById(createdList.id)
    
    expect(retrievedList).toBeDefined()
    expect((retrievedList as any).id).toBe(createdList.id)
    expect((retrievedList as any).name).toBe("Test List")
  })

  it("should update a list", () => {
    const createdList = createList("Test List", "#ff0000", "🔴", "Test") as any
    const updatedList = updateList(createdList.id, {
      name: "Updated List",
      color: "#00ff00"
    }) as any
    
    expect(updatedList.name).toBe("Updated List")
    expect(updatedList.color).toBe("#00ff00")
    expect(updatedList.emoji).toBe("🔴") // Should remain unchanged
  })

  it("should delete a list", () => {
    const createdList = createList("Test List", "#ff0000", "🔴", "Test") as any
    deleteList(createdList.id)
    
    const deletedList = getListById(createdList.id)
    expect(deletedList).toBeUndefined()
  })
})
