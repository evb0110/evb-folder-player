package com.evb.folderaudio

import android.app.Activity
import android.app.DownloadManager
import android.content.Intent
import android.net.Uri
import androidx.media3.common.util.UnstableApi
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.util.concurrent.Executors

@UnstableApi
class FolderAudioModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext) { "Application is unavailable" }
  private val store by lazy { LibraryStore(context.applicationContext) }
  private var pendingPicker: Promise? = null
  private val scanner = Executors.newSingleThreadExecutor()
  override fun definition() = ModuleDefinition {
    Name("FolderAudio")
    AsyncFunction("getTheme") { store.read("theme", "system") }
    AsyncFunction("setTheme") { value: String ->
      require(value in listOf("system", "light", "dark")) { "Unknown theme" }
      store.write("theme", value)
    }
    // A tip the user closed stays closed.
    AsyncFunction("isTipDismissed") { id: String -> store.read("tip.$id") == "dismissed" }
    AsyncFunction("dismissTip") { id: String -> store.write("tip.$id", "dismissed") }
    AsyncFunction("getLibrary") { store.books().toString() }
    AsyncFunction("getHistory") { store.history().toString() }
    AsyncFunction("getStatus") {
      (PlaybackService.instance?.status() ?: store.current().put("playing", false).put("loading", false)
        .put("speed", store.read("speed", "1.0").toDouble()).put("boost", store.read("boost", "0").toIntOrNull() ?: 0)
        .put("canUndo", store.undoPoint() != null))
        .put("import", ImportService.snapshot()).toString()
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("command") { action: String, data: String ->
      PlaybackService.dispatch(context, action, JSONObject(data))
      Unit
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("pickFolder") { promise: Promise ->
      if (pendingPicker != null) { promise.reject("PICKER_OPEN", "A folder picker is already open", null) }
      else {
        val activity = appContext.currentActivity
        if (activity == null) promise.reject("NO_ACTIVITY", "Open the app before choosing a folder", null)
        else {
          pendingPicker = promise
          activity.startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or Intent.FLAG_GRANT_PREFIX_URI_PERMISSION), 4201)
        }
      }
    }.runOnQueue(Queues.MAIN)
    OnActivityResult { _, payload ->
      if (payload.requestCode == 4201) {
        val promise = pendingPicker; pendingPicker = null
        val uri = payload.data?.data
        if (payload.resultCode != Activity.RESULT_OK || uri == null) promise?.resolve(false)
        else {
          try {
            // Write access lets opened archives be unpacked into the newest library folder.
            if (ImportFolder.retain(context, uri, payload.data?.flags ?: 0)) store.write("importRoot", uri.toString())
            scanner.execute {
              try {
                val books = FolderScanner(context.applicationContext).scanTree(uri)
                store.replaceRoot(uri.toString(), books); store.addRoot(uri.toString())
                promise?.resolve(true)
              } catch (failure: Exception) { promise?.reject("SCAN_FAILED", failure.message ?: "Could not read this folder", failure) }
            }
          } catch (failure: Exception) { promise?.reject("ACCESS_FAILED", "Could not retain folder access", failure) }
        }
      }
    }
    AsyncFunction("scanDevice") {
      val books = FolderScanner(context.applicationContext).scanDevice()
      store.replaceRoot("device", books); store.addRoot("device"); books.size
    }
    AsyncFunction("rescan") {
      val roots = store.roots()
      val failures = mutableListOf<String>()
      for (i in 0 until roots.length()) {
        val root = roots.getString(i)
        try {
          val scanner = FolderScanner(context.applicationContext)
          val books = if (root == "device") scanner.scanDevice() else scanner.scanTree(Uri.parse(root))
          store.replaceRoot(root, books)
        } catch (failure: Exception) { failures.add(failure.message ?: "A folder could not be read") }
      }
      if (failures.isNotEmpty()) throw IllegalStateException(failures.joinToString("\n"))
      true
    }
    AsyncFunction("getImportFolder") {
      ImportFolder.find(context, store)?.let { root -> runCatching { FolderScanner(context.applicationContext).rootName(Uri.parse(root)) }.getOrNull() }
    }
    AsyncFunction("cancelImport") { ImportService.cancel() }
    AsyncFunction("dismissImport") { ImportService.dismiss() }
    AsyncFunction("openDownloads") {
      // The system file manager's Downloads view, where a downloaded archive can be deleted.
      context.startActivity(Intent(DownloadManager.ACTION_VIEW_DOWNLOADS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    AsyncFunction("addSample") { data: String ->
      val book = JSONObject(data)
      store.replaceRoot("sample", listOf(book))
      true
    }
    OnDestroy {
      pendingPicker?.reject("CLOSED", "The folder picker was closed", null); pendingPicker = null
      scanner.shutdown()
    }
  }
}
