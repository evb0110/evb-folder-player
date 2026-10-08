package com.evb.folderaudio

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.DocumentsContract
import android.widget.Toast

/** The folder that receives imported audiobooks: a library folder the user allowed the app to write to. */
object ImportFolder {
  fun find(context: Context, store: LibraryStore): String? {
    val writable = context.contentResolver.persistedUriPermissions.filter { it.isWritePermission }.map { it.uri.toString() }.toSet()
    val preferred = store.read("importRoot", "")
    if (preferred in writable) return preferred
    val roots = store.roots()
    return (0 until roots.length()).map { roots.getString(it) }.lastOrNull { it in writable }
  }

  /** Keeps folder access across restarts, with write access when the picker granted it. */
  fun retain(context: Context, tree: Uri, grantFlags: Int): Boolean {
    val resolver = context.contentResolver
    if (grantFlags and Intent.FLAG_GRANT_WRITE_URI_PERMISSION != 0) {
      try {
        resolver.takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        return true
      } catch (_: SecurityException) {}
    }
    resolver.takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION)
    return false
  }

  /** The system folder picker, opened at the current library folder or at Audiobooks. */
  fun picker(store: LibraryStore): Intent {
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(
      Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
        Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION or Intent.FLAG_GRANT_PREFIX_URI_PERMISSION,
    )
    if (Build.VERSION.SDK_INT >= 26) {
      val roots = store.roots()
      val library = (0 until roots.length()).map { roots.getString(it) }.lastOrNull { it.startsWith("content://") }?.let {
        val tree = Uri.parse(it)
        DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
      }
      intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, library ?: DocumentsContract.buildDocumentUri("com.android.externalstorage.documents", "primary:Audiobooks"))
    }
    return intent
  }
}

/** Receives a ZIP archive from "Open with" or "Share", then hands it to [ImportService]. */
class ImportActivity : Activity() {
  private companion object { const val PICK = 4211 }
  private var archive: Uri? = null
  private var writable = false
  private var picking = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    archive = when (intent.action) {
      Intent.ACTION_VIEW -> intent.data
      Intent.ACTION_SEND -> if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        else @Suppress("DEPRECATION") intent.getParcelableExtra(Intent.EXTRA_STREAM)
      else -> null
    }?.takeIf { it.scheme == "content" }
    writable = intent.flags and Intent.FLAG_GRANT_WRITE_URI_PERMISSION != 0
    if (archive == null) {
      Toast.makeText(this, "There is no archive to import.", Toast.LENGTH_LONG).show()
      finish(); return
    }
    picking = savedInstanceState?.getBoolean("picking") == true
    if (picking) return
    val root = withStore { ImportFolder.find(this, it) }
    if (root != null) begin(root) else ask()
  }

  override fun onSaveInstanceState(outState: Bundle) {
    super.onSaveInstanceState(outState)
    outState.putBoolean("picking", picking)
  }

  private fun ask() {
    val night = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
    val theme = if (night) android.R.style.Theme_DeviceDefault_Dialog_Alert else android.R.style.Theme_DeviceDefault_Light_Dialog_Alert
    AlertDialog.Builder(this, theme)
      .setTitle("Choose a folder for audiobooks")
      .setMessage("Archives you open are unpacked into this folder, for example Audiobooks. Choose it, then tap Use this folder and Allow. You only need to do this once.")
      .setPositiveButton("Choose folder") { _, _ ->
        picking = true
        startActivityForResult(withStore { ImportFolder.picker(it) }, PICK)
      }
      .setNegativeButton("Cancel") { _, _ -> finish() }
      .setOnCancelListener { finish() }
      .show()
  }

  @Deprecated("Activity result API is not used by this small entry point")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != PICK) return
    picking = false
    val tree = data?.data
    if (resultCode != RESULT_OK || tree == null) { finish(); return }
    val canWrite = try { ImportFolder.retain(this, tree, data.flags) } catch (_: SecurityException) { false }
    if (!canWrite) {
      Toast.makeText(this, "The app cannot save into that folder. Open the archive again and choose another folder.", Toast.LENGTH_LONG).show()
      finish(); return
    }
    withStore { it.write("importRoot", tree.toString()) }
    begin(tree.toString())
  }

  private fun begin(root: String) {
    ImportService.start(this, archive!!, root, writable)
    packageManager.getLaunchIntentForPackage(packageName)?.let { startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    finish()
  }

  private fun <T> withStore(block: (LibraryStore) -> T): T {
    val store = LibraryStore(applicationContext)
    try { return block(store) } finally { store.close() }
  }
}
