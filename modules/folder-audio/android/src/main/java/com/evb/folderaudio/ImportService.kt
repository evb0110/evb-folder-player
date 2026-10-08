package com.evb.folderaudio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.provider.DocumentsContract
import android.provider.OpenableColumns
import android.system.Os
import org.json.JSONObject
import java.io.EOFException
import java.io.FileNotFoundException
import java.io.FilterInputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.CancellationException
import java.util.concurrent.Executors

/** Storage Access Framework folder. Writing needs a persisted write grant on [tree]. */
class DocumentTarget(private val context: Context, private val tree: Uri) : ImportTarget {
  private val resolver get() = context.contentResolver
  override val root: String = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree)).toString()
  override fun children(directory: String): List<ImportNode> {
    val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(Uri.parse(directory)))
    val columns = arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE)
    return resolver.query(children, columns, null, null, null)?.use { c ->
      buildList { while (c.moveToNext()) add(ImportNode(c.getString(1), DocumentsContract.buildDocumentUriUsingTree(tree, c.getString(0)).toString(), c.getString(2) == DocumentsContract.Document.MIME_TYPE_DIR)) }
    } ?: throw IOException("Cannot read the import folder")
  }
  override fun createDirectory(parent: String, name: String) = create(parent, DocumentsContract.Document.MIME_TYPE_DIR, name)
  // A generic type keeps the name exactly; a specific type can make the provider append an extension.
  override fun createFile(parent: String, name: String) = create(parent, "application/octet-stream", name)
  private fun create(parent: String, mime: String, name: String) =
    DocumentsContract.createDocument(resolver, Uri.parse(parent), mime, name)?.toString() ?: throw IOException("Cannot create $name")
  override fun openOutput(file: String): OutputStream = resolver.openOutputStream(Uri.parse(file), "w") ?: throw IOException("Cannot write ${Uri.parse(file).lastPathSegment}")
  override fun freeSpace(file: String): Long? = try {
    resolver.openFileDescriptor(Uri.parse(file), "r")?.use { Os.fstatvfs(it.fileDescriptor).let { stat -> stat.f_bavail * stat.f_frsize } }
  } catch (_: Exception) { null }
  override fun rename(node: String, name: String) =
    DocumentsContract.renameDocument(resolver, Uri.parse(node), name)?.toString() ?: throw IOException("Cannot rename to $name")
  override fun move(node: String, from: String, to: String): String? = try {
    DocumentsContract.moveDocument(resolver, Uri.parse(node), Uri.parse(from), Uri.parse(to))?.toString()
  } catch (_: Exception) { null }
  override fun delete(node: String) { DocumentsContract.deleteDocument(resolver, Uri.parse(node)) }
}

/** Unpacks opened archives in a foreground service, so a long import continues outside the app. */
class ImportService : Service() {
  companion object {
    private const val CHANNEL = "imports"
    private const val PROGRESS_ID = 4301
    private const val RESULT_ID = 4302
    private const val ACTION_CANCEL = "com.evb.folderaudio.CANCEL_IMPORT"
    @Volatile private var state: JSONObject? = null
    @Volatile private var cancelled = false
    private var nextId = System.currentTimeMillis()

    fun start(context: Context, archive: Uri, root: String, writable: Boolean) {
      val grant = Intent.FLAG_GRANT_READ_URI_PERMISSION or if (writable) Intent.FLAG_GRANT_WRITE_URI_PERMISSION else 0
      // The grant on this intent keeps the archive readable after the opening activity finishes.
      val intent = Intent(context, ImportService::class.java).setData(archive).addFlags(grant).putExtra("root", root).putExtra("writable", writable)
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
    }
    fun snapshot(): Any = state?.let { JSONObject(it.toString()) } ?: JSONObject.NULL
    fun cancel() { cancelled = true }
    fun dismiss() { if (state?.optString("state") != "running") state = null }
  }

  private class CountingInput(source: InputStream) : FilterInputStream(source) {
    @Volatile var count = 0L
    override fun read(): Int = super.read().also { if (it >= 0) count++ }
    override fun read(b: ByteArray, off: Int, len: Int): Int = super.read(b, off, len).also { if (it > 0) count += it }
    override fun skip(n: Long): Long = super.skip(n).also { count += it }
  }

  private val executor = Executors.newSingleThreadExecutor()
  private val main = Handler(Looper.getMainLooper())
  private val notifications get() = getSystemService(NotificationManager::class.java)
  private var pending = 0
  private var lastStartId = 0

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    lastStartId = startId
    if (intent?.action == ACTION_CANCEL) {
      cancelled = true
      if (pending == 0) stopSelf(startId)
      return START_NOT_STICKY
    }
    val archive = intent?.data
    val root = intent?.getStringExtra("root")
    // startForegroundService requires this promptly, even for an intent that turns out to be unusable.
    foreground(notification("Preparing import", null, null, true))
    if (archive == null || root == null) {
      if (pending == 0) { stopForeground(true); stopSelf(startId) }
      return START_NOT_STICKY
    }
    pending++
    val writable = intent.getBooleanExtra("writable", false)
    executor.execute {
      try { run(archive, Uri.parse(root), writable) }
      finally {
        main.post {
          pending--
          if (pending == 0) { stopForeground(true); stopSelf(lastStartId) }
        }
      }
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    cancelled = true
    executor.shutdown()
    super.onDestroy()
  }

  private fun run(archive: Uri, tree: Uri, writable: Boolean) {
    cancelled = false
    val name = query(archive, OpenableColumns.DISPLAY_NAME) ?: archive.lastPathSegment?.substringAfterLast('/') ?: "archive.zip"
    val size = query(archive, OpenableColumns.SIZE)?.toLongOrNull()?.takeIf { it > 0 }
    val id = ++nextId
    val base = JSONObject().put("id", id).put("name", name)
    fun update(next: JSONObject) { state = next }
    update(JSONObject(base.toString()).put("state", "running").put("progress", 0))
    showProgress(name, 0.0, size != null)
    try {
      val input = try { contentResolver.openInputStream(archive) } catch (_: Exception) { null }
        ?: throw ImportException("The archive is no longer available. Open it again from the app you received it in.")
      var lastUpdate = 0L
      val counting = CountingInput(input)
      val result = counting.use {
        ArchiveImporter(DocumentTarget(this, tree), { cancelled }, onProgress = {
          val now = SystemClock.elapsedRealtime()
          if (now - lastUpdate >= 500) {
            lastUpdate = now
            val progress = if (size == null) -1.0 else (counting.count.toDouble() / size).coerceIn(0.0, 1.0)
            update(JSONObject(base.toString()).put("state", "running").put("progress", progress))
            showProgress(name, progress, size != null)
          }
        }).import(counting, name, size)
      }
      val scanner = FolderScanner(applicationContext)
      var bookId: String? = null
      val destination = runCatching { scanner.rootName(tree) }.getOrDefault("your folder")
      try {
        val books = scanner.scanTree(tree)
        val store = LibraryStore(applicationContext)
        try { store.replaceRoot(tree.toString(), books); store.addRoot(tree.toString()) } finally { store.close() }
        val prefix = "$destination/${result.folder}"
        bookId = books.firstOrNull { val path = it.getString("path"); path == prefix || path.startsWith("$prefix/") }?.getString("id")
      } catch (_: Exception) {
        // The files are in place; Rescan in the library adds them once the folder can be read.
      }
      val source = when {
        archive.authority.orEmpty().contains("telegram") -> "telegram"
        archive.toString().lowercase().contains("download") -> "downloads"
        else -> "other"
      }
      update(JSONObject(base.toString()).put("state", "done").put("folder", result.folder).put("destination", destination)
        .put("bookId", bookId ?: JSONObject.NULL).put("archive", if (writable && removeArchive(archive)) "deleted" else "kept").put("source", source))
      showResult("Added ${result.folder}", "Saved to $destination")
    } catch (_: CancellationException) {
      update(JSONObject(base.toString()).put("state", "cancelled"))
      notifications.cancel(RESULT_ID)
    } catch (failure: Exception) {
      val message = when (failure) {
        is ImportException, is EOFException -> failure.message
        is SecurityException, is FileNotFoundException -> "The app can no longer write to the import folder. Choose a folder again in Add audiobooks."
        else -> if (failure.message.orEmpty().contains("ENOSPC") || failure.message.orEmpty().contains("No space")) "The phone ran out of storage space."
          else "The archive could not be imported. (${failure.message ?: failure.javaClass.simpleName})"
      }
      update(JSONObject(base.toString()).put("state", "failed").put("message", message))
      showResult("Could not import $name", message ?: "")
    }
  }

  /**
   * Only an app that opened the archive with write access lets it be deleted. Android offers no
   * confirmation for deleting another app's ZIP, so Telegram's and browsers' copies stay theirs.
   */
  private fun removeArchive(archive: Uri): Boolean = try {
    if (DocumentsContract.isDocumentUri(this, archive)) DocumentsContract.deleteDocument(contentResolver, archive)
    else contentResolver.delete(archive, null, null) > 0
  } catch (_: Exception) { false }

  private fun query(uri: Uri, column: String): String? = try {
    contentResolver.query(uri, arrayOf(column), null, null, null)?.use { if (it.moveToFirst() && !it.isNull(0)) it.getString(0) else null }
  } catch (_: Exception) { null }

  private fun foreground(notification: Notification) {
    if (Build.VERSION.SDK_INT >= 29) startForeground(PROGRESS_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    else startForeground(PROGRESS_ID, notification)
  }

  private fun showProgress(name: String, progress: Double, known: Boolean) =
    notifications.notify(PROGRESS_ID, notification("Importing $name", null, if (known) (progress * 100).toInt() else -1, true))

  private fun showResult(title: String, text: String) = notifications.notify(RESULT_ID, notification(title, text, null, false))

  private fun notification(title: String, text: String?, percent: Int?, ongoing: Boolean): Notification {
    if (Build.VERSION.SDK_INT >= 26) {
      notifications.createNotificationChannel(NotificationChannel(CHANNEL, "Archive imports", NotificationManager.IMPORTANCE_LOW))
    }
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(this)
    builder.setContentTitle(title).setOngoing(ongoing).setAutoCancel(!ongoing).setOnlyAlertOnce(true)
      .setSmallIcon(if (ongoing) android.R.drawable.stat_sys_download else android.R.drawable.stat_sys_download_done)
    text?.let { builder.setContentText(it) }
    packageManager.getLaunchIntentForPackage(packageName)?.let {
      builder.setContentIntent(PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
    }
    if (ongoing) {
      percent?.let { builder.setProgress(100, it.coerceAtLeast(0), it < 0) }
      val cancel = PendingIntent.getService(this, 1, Intent(this, ImportService::class.java).setAction(ACTION_CANCEL), PendingIntent.FLAG_IMMUTABLE)
      @Suppress("DEPRECATION") builder.addAction(0, "Cancel", cancel)
    }
    return builder.build()
  }
}
