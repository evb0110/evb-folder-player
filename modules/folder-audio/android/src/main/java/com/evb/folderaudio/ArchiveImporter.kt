package com.evb.folderaudio

import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.CancellationException

class ImportNode(val name: String, val handle: String, val directory: Boolean)

/** Where an archive is unpacked. Handles are document URIs on Android and paths in tests. */
interface ImportTarget {
  val root: String
  fun children(directory: String): List<ImportNode>
  fun createDirectory(parent: String, name: String): String
  fun createFile(parent: String, name: String): String
  fun openOutput(file: String): OutputStream
  /** Bytes available on the volume holding [file], or null when unknown. */
  fun freeSpace(file: String): Long?
  fun rename(node: String, name: String): String
  /** The moved node, or null when the storage cannot move documents. */
  fun move(node: String, from: String, to: String): String?
  fun delete(node: String)
}

class ImportResult(val folder: String, val files: Int, val audio: Int)

/**
 * Unpacks into a hidden folder and renames it only after every file is written, so a failed or
 * cancelled import never leaves half a book in the library. Existing files are never touched.
 */
class ArchiveImporter(
  private val target: ImportTarget,
  private val cancelled: () -> Boolean = { false },
  private val onProgress: () -> Unit = {},
  /** Extra bytes allowed beyond twice the archive size, for small text-heavy archives. */
  private val slack: Long = 512L * 1024 * 1024,
) {
  companion object {
    const val TEMP_PREFIX = ".evb-import-"
    private const val MAX_FILES = 20000
    private const val SPACE_MARGIN = 64L * 1024 * 1024
    private val AUDIO = setOf("mp3", "m4a", "m4b", "aac", "ogg", "opus", "flac", "wav", "mp4")
    fun isAudio(name: String) = name.substringAfterLast('.', "").lowercase() in AUDIO
    fun folderName(archive: String) = ZipNames.segment(archive.substringBeforeLast('.').ifBlank { "Imported audiobook" })
    fun unique(name: String, taken: Collection<String>): String {
      val lower = taken.map { it.lowercase() }.toSet()
      if (name.lowercase() !in lower) return name
      return (2..Int.MAX_VALUE).asSequence().map { "$name ($it)" }.first { it.lowercase() !in lower }
    }
  }

  fun import(input: InputStream, archiveName: String, archiveSize: Long?): ImportResult {
    // Only one import runs at a time, so any earlier hidden folder was abandoned by a killed process.
    target.children(target.root).filter { it.directory && it.name.startsWith(TEMP_PREFIX) }
      .forEach { runCatching { target.delete(it.handle) } }
    val temp = target.createDirectory(target.root, TEMP_PREFIX + System.currentTimeMillis())
    try {
      val counts = unpack(input, temp, archiveSize)
      if (counts.second == 0) throw ImportException("This archive has no audio files.")
      return ImportResult(publish(temp, archiveName), counts.first, counts.second)
    } catch (failure: Throwable) {
      runCatching { target.delete(temp) }
      throw failure
    }
  }

  private fun unpack(input: InputStream, temp: String, archiveSize: Long?): Pair<Int, Int> {
    // Audio barely compresses, so a much larger expansion means a damaged or hostile archive.
    val limit = archiveSize?.let { maxOf(it * 2, it + slack) } ?: Long.MAX_VALUE
    val folders = mutableMapOf("" to temp)
    val buffer = ByteArray(256 * 1024)
    var written = 0L; var files = 0; var audio = 0; var spaceChecked = false
    ZipReader(input).use { zip ->
      while (true) {
        if (cancelled()) throw CancellationException()
        val item = zip.next() ?: break
        val path = ZipNames.path(item.name) ?: continue
        if (++files > MAX_FILES) throw ImportException("This archive has too many files.")
        var parent = temp
        for (depth in 1 until path.size) {
          val key = path.subList(0, depth).joinToString("/")
          parent = folders.getOrPut(key) { target.createDirectory(parent, path[depth - 1]) }
        }
        val file = target.createFile(parent, path.last())
        if (!spaceChecked && archiveSize != null) {
          spaceChecked = true
          val free = target.freeSpace(file)
          if (free != null && free < archiveSize + SPACE_MARGIN) {
            throw ImportException("Not enough free space. The archive needs about ${megabytes(archiveSize + SPACE_MARGIN)} MB; ${megabytes(free)} MB is free.")
          }
        }
        target.openOutput(file).use { out ->
          val data = zip.data()
          while (true) {
            if (cancelled()) throw CancellationException()
            val count = data.read(buffer)
            if (count < 0) break
            written += count
            if (written > limit) throw ImportException("This archive unpacks to far more data than its size. It was not imported.")
            out.write(buffer, 0, count)
            onProgress()
          }
        }
        if (isAudio(path.last())) audio++
      }
    }
    return files to audio
  }

  /** An archive holding one folder becomes that folder; anything else is named after the archive. */
  private fun publish(temp: String, archiveName: String): String {
    val taken = target.children(target.root).map { it.name }
    val top = target.children(temp)
    val single = top.singleOrNull()?.takeIf { it.directory }
    if (single != null) {
      val name = unique(single.name, taken)
      val renamed = if (name == single.name) single.handle else target.rename(single.handle, name)
      if (target.move(renamed, temp, target.root) != null) {
        target.delete(temp)
        return name
      }
    }
    val name = unique(folderName(archiveName), taken)
    target.rename(temp, name)
    return name
  }

  private fun megabytes(bytes: Long) = (bytes + 999_999) / 1_000_000
}
