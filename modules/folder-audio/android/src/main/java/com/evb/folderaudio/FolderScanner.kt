package com.evb.folderaudio

import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.MediaStore
import org.json.JSONArray
import org.json.JSONObject

object NaturalOrder : Comparator<String> {
  private val chunks = Regex("[0-9]+|[^0-9]+")
  override fun compare(a: String, b: String): Int {
    val aa = chunks.findAll(a.lowercase()).map { it.value }.toList()
    val bb = chunks.findAll(b.lowercase()).map { it.value }.toList()
    for (i in 0 until minOf(aa.size, bb.size)) {
      val x = aa[i]; val y = bb[i]
      val result = if (x.first().isDigit() && y.first().isDigit()) {
        val xx = x.trimStart('0').ifEmpty { "0" }; val yy = y.trimStart('0').ifEmpty { "0" }
        val length = xx.length.compareTo(yy.length)
        if (length != 0) length else xx.compareTo(yy)
      } else x.compareTo(y)
      if (result != 0) return result
    }
    return aa.size.compareTo(bb.size).takeIf { it != 0 } ?: a.compareTo(b)
  }
}

class FolderScanner(private val context: Context) {
  private val resolver get() = context.contentResolver
  private val extensions = setOf("mp3", "m4a", "m4b", "aac", "ogg", "opus", "flac", "wav", "mp4")
  fun scanTree(tree: Uri): List<JSONObject> {
    val result = mutableListOf<JSONObject>()
    val visited = mutableSetOf<String>()
    fun visit(id: String, path: String, name: String) {
      check(visited.size < 50000) { "This folder is too large. Choose a smaller audiobook folder." }
      if (!visited.add(id)) return
      val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, id)
      val tracks = mutableListOf<JSONObject>()
      val folders = mutableListOf<Pair<String, String>>()
      val columns = arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE)
      val cursor = resolver.query(children, columns, null, null, null) ?: error("Cannot read $name. Please grant folder access again.")
      cursor.use { c ->
        while (c.moveToNext()) {
          val docId = c.getString(0); val title = c.getString(1); val mime = c.getString(2) ?: ""
          if (mime == DocumentsContract.Document.MIME_TYPE_DIR) folders.add(docId to title)
          else if (mime.startsWith("audio/") || title.substringAfterLast('.').lowercase() in extensions) {
            val uri = DocumentsContract.buildDocumentUriUsingTree(tree, docId).toString()
            tracks.add(JSONObject().put("id", uri).put("uri", uri).put("name", title).put("title", title.substringBeforeLast('.')).put("duration", 0))
          }
        }
      }
      tracks.sortWith { a, b -> NaturalOrder.compare(a.getString("name"), b.getString("name")) }
      if (tracks.isNotEmpty()) result.add(JSONObject().put("id", DocumentsContract.buildDocumentUriUsingTree(tree, id).toString()).put("root", tree.toString()).put("name", name).put("path", path).put("tracks", JSONArray(tracks)))
      folders.sortedWith { a, b -> NaturalOrder.compare(a.second, b.second) }.forEach { (childId, childName) -> visit(childId, "$path/$childName", childName) }
    }
    val id = DocumentsContract.getTreeDocumentId(tree)
    val rootUri = DocumentsContract.buildDocumentUriUsingTree(tree, id)
    val name = resolver.query(rootUri, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use { if(it.moveToFirst()) it.getString(0) else null } ?: "Audiobooks"
    visit(id, name, name)
    return result
  }
  fun scanDevice(): List<JSONObject> {
    val grouped = linkedMapOf<String, MutableList<JSONObject>>()
    val collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
    val pathColumn = if (android.os.Build.VERSION.SDK_INT >= 29) MediaStore.MediaColumns.RELATIVE_PATH else MediaStore.MediaColumns.DATA
    resolver.query(collection, arrayOf(MediaStore.Audio.Media._ID, MediaStore.Audio.Media.DISPLAY_NAME, MediaStore.Audio.Media.DURATION, pathColumn), null, null, null)?.use { c ->
      while (c.moveToNext()) {
        val name = c.getString(1) ?: continue
        val rawPath = c.getString(3) ?: "Audio"
        val path = if (android.os.Build.VERSION.SDK_INT >= 29) rawPath.trimEnd('/') else rawPath.substringBeforeLast('/')
        val uri = ContentUris.withAppendedId(collection, c.getLong(0)).toString()
        grouped.getOrPut(path) { mutableListOf() }.add(JSONObject().put("id", uri).put("uri", uri).put("name", name).put("title", name.substringBeforeLast('.')).put("duration", c.getLong(2)))
      }
    } ?: error("Cannot scan device audio. Check the audio permission.")
    return grouped.map { (path, tracks) ->
      tracks.sortWith { a, b -> NaturalOrder.compare(a.getString("name"), b.getString("name")) }
      JSONObject().put("id", "device:$path").put("root", "device").put("name", path.substringAfterLast('/')).put("path", path).put("tracks", JSONArray(tracks))
    }
  }
}
