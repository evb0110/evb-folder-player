package com.evb.folderaudio

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject

/** SQLite owns the listening journal. No React lifecycle or shutdown callback is required. */
class LibraryStore(context: Context, name: String = "folder-player.db") : SQLiteOpenHelper(context, name, null, 1) {
  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL("CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    db.execSQL("CREATE TABLE books (id TEXT PRIMARY KEY, root TEXT NOT NULL, data TEXT NOT NULL)")
    db.execSQL("CREATE TABLE progress (book TEXT PRIMARY KEY, data TEXT NOT NULL)")
    db.execSQL("CREATE TABLE history (id INTEGER PRIMARY KEY AUTOINCREMENT, time INTEGER NOT NULL, reason TEXT NOT NULL, data TEXT NOT NULL, undone INTEGER NOT NULL DEFAULT 0)")
  }
  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

  @Synchronized fun read(key: String, fallback: String = ""): String = readableDatabase.rawQuery("SELECT value FROM kv WHERE key=?", arrayOf(key)).use { if (it.moveToFirst()) it.getString(0) else fallback }
  @Synchronized fun write(key: String, value: String) {
    writableDatabase.insertWithOnConflict("kv", null, ContentValues().apply { put("key", key); put("value", value) }, SQLiteDatabase.CONFLICT_REPLACE)
  }
  fun current(): JSONObject = JSONObject(read("current", "{}"))
  fun roots(): JSONArray = JSONArray(read("roots", "[]"))
  @Synchronized fun addRoot(uri: String) {
    val roots = roots()
    if ((0 until roots.length()).none { roots.getString(it) == uri }) { roots.put(uri); write("roots", roots.toString()) }
  }
  @Synchronized fun book(id: String): JSONObject? = readableDatabase.rawQuery("SELECT data FROM books WHERE id=?", arrayOf(id)).use { if (it.moveToFirst()) JSONObject(it.getString(0)) else null }
  @Synchronized fun books(): JSONArray {
    val result = JSONArray()
    readableDatabase.rawQuery("SELECT data FROM books ORDER BY id", null).use { cursor ->
      while (cursor.moveToNext()) {
        val book = JSONObject(cursor.getString(0))
        book.put("progress", progress(book.getString("id")))
        result.put(book)
      }
    }
    return result
  }
  @Synchronized fun progress(book: String): JSONObject? = readableDatabase.rawQuery("SELECT data FROM progress WHERE book=?", arrayOf(book)).use { if (it.moveToFirst()) JSONObject(it.getString(0)) else null }

  /** A failed scan never reaches this transaction; positions are retained even if files disappear. */
  @Synchronized fun replaceRoot(root: String, books: List<JSONObject>) {
    val db = writableDatabase
    db.beginTransaction()
    try {
      db.delete("books", "root=?", arrayOf(root))
      books.forEach { book -> db.insertOrThrow("books", null, ContentValues().apply { put("id", book.getString("id")); put("root", root); put("data", book.toString()) }) }
      db.setTransactionSuccessful()
    } finally { db.endTransaction() }
  }

  @Synchronized fun save(point: JSONObject, reason: String? = null) {
    if (!point.has("bookId") || !point.has("trackId")) return
    val db = writableDatabase
    db.beginTransaction()
    try {
      val data = JSONObject(point.toString()).put("savedAt", System.currentTimeMillis()).toString()
      db.insertWithOnConflict("progress", null, ContentValues().apply { put("book", point.getString("bookId")); put("data", data) }, SQLiteDatabase.CONFLICT_REPLACE)
      write("current", data)
      if (reason != null) {
        db.insertOrThrow("history", null, ContentValues().apply { put("time", System.currentTimeMillis()); put("reason", reason); put("data", data) })
        db.execSQL("DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY id DESC LIMIT 400)")
      }
      db.setTransactionSuccessful()
    } finally { db.endTransaction() }
  }
  @Synchronized fun history(): JSONArray {
    val result = JSONArray()
    readableDatabase.rawQuery("SELECT id,time,reason,data,undone FROM history ORDER BY id DESC LIMIT 400", null).use { c ->
      while (c.moveToNext()) result.put(JSONObject(c.getString(3)).put("id", c.getLong(0)).put("time", c.getLong(1)).put("reason", c.getString(2)).put("undone", c.getInt(4) == 1))
    }
    return result
  }
  @Synchronized fun undoPoint(): JSONObject? = readableDatabase.rawQuery("SELECT id,data FROM history WHERE reason LIKE 'Before %' AND undone=0 ORDER BY id DESC LIMIT 1", null).use { if (it.moveToFirst()) JSONObject(it.getString(1)).put("historyId", it.getLong(0)) else null }
  @Synchronized fun markUndone(id: Long) { writableDatabase.execSQL("UPDATE history SET undone=1 WHERE id=?", arrayOf(id)) }
}
