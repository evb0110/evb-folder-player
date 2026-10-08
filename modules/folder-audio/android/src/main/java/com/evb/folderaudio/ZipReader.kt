package com.evb.folderaudio

import java.io.EOFException
import java.io.InputStream
import java.io.PushbackInputStream
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.CodingErrorAction
import java.util.zip.CRC32
import java.util.zip.DataFormatException
import java.util.zip.Inflater
import java.util.zip.ZipException

/** A user-facing import failure. The message is shown as written. */
class ImportException(message: String) : Exception(message)

class ZipItem(val name: String, val directory: Boolean)

/**
 * Reads a ZIP archive front to back. Shared files often arrive as pipes that cannot seek, and reading
 * the local headers keeps each name's raw bytes and flags, which name decoding needs.
 */
class ZipReader(source: InputStream) : AutoCloseable {
  private companion object {
    const val LOCAL = 0x04034b50L
    const val CENTRAL = 0x02014b50L
    const val END = 0x06054b50L
    const val ZIP64_END = 0x06064b50L
    const val DESCRIPTOR = 0x08074b50L
    const val BUFFER = 64 * 1024
  }
  private val input = PushbackInputStream(source, BUFFER)
  private var current: EntryData? = null
  private var started = false

  fun next(): ZipItem? {
    current?.let { data -> val skip = ByteArray(BUFFER); while (data.read(skip, 0, skip.size) >= 0) Unit }
    current = null
    val signature = signature()
    if (signature != LOCAL) {
      if (!started && signature != END) throw ImportException("This file is not a ZIP archive.")
      if (signature == null || signature == CENTRAL || signature == END || signature == ZIP64_END) return null
      throw ImportException("This archive is damaged.")
    }
    started = true
    val header = bytes(26)
    val flags = u16(header, 2)
    val method = u16(header, 4)
    val crc = u32(header, 10)
    var compressed = u32(header, 14)
    var size = u32(header, 18)
    val raw = bytes(u16(header, 22))
    val extra = bytes(u16(header, 24))
    if (flags and 1 != 0) throw ImportException("This archive is password-protected. Create it again without a password.")
    if (method != 0 && method != 8) throw ImportException("This archive uses a compression method the app cannot read. Create it again as a standard ZIP.")
    var zip64 = false
    var unicodePath: String? = null
    var at = 0
    while (at + 4 <= extra.size) {
      val id = u16(extra, at); val length = u16(extra, at + 2); val body = at + 4
      if (body + length > extra.size) break
      if (id == 0x0001) {
        zip64 = true
        var field = body
        if (size == 0xFFFFFFFFL && field + 8 <= body + length) { size = u64(extra, field); field += 8 }
        if (compressed == 0xFFFFFFFFL && field + 8 <= body + length) compressed = u64(extra, field)
      }
      // Info-ZIP Unicode Path: valid only while the CRC still matches the stored legacy name.
      if (id == 0x7075 && length > 5 && extra[body].toInt() == 1 && u32(extra, body + 1) == CRC32().apply { update(raw) }.value) {
        unicodePath = String(extra, body + 5, length - 5, Charsets.UTF_8)
      }
      at = body + length
    }
    val name = ZipNames.decode(raw, flags, unicodePath)
    val deferred = flags and 8 != 0
    if (method == 0 && deferred && compressed == 0L) throw ImportException("This archive was written in a streaming format the app cannot read. Create it again as a standard ZIP.")
    current = EntryData(method, deferred, zip64, crc, compressed, size)
    return ZipItem(name, name.endsWith("/") || name.endsWith("\\"))
  }

  /** The current entry's contents, verified against its CRC when fully read. */
  fun data(): InputStream = current ?: error("No current entry")

  override fun close() = input.close()

  private inner class EntryData(
    private val method: Int, private val deferred: Boolean, private val zip64: Boolean,
    private var crc: Long, compressed: Long, private var size: Long,
  ) : InputStream() {
    private val checksum = CRC32()
    private val inflater = if (method == 8) Inflater(true) else null
    private val chunk = ByteArray(BUFFER)
    private var chunkLength = 0
    private var remaining = compressed
    private var produced = 0L
    private var done = false

    override fun read(): Int { val one = ByteArray(1); return if (read(one, 0, 1) < 0) -1 else one[0].toInt() and 0xFF }

    override fun read(b: ByteArray, off: Int, len: Int): Int {
      if (done) return -1
      if (len == 0) return 0
      val count = if (inflater == null) stored(b, off, len) else inflated(b, off, len)
      if (count < 0) { finish(); return -1 }
      checksum.update(b, off, count); produced += count
      return count
    }

    private fun stored(b: ByteArray, off: Int, len: Int): Int {
      if (remaining == 0L) return -1
      val count = input.read(b, off, minOf(len.toLong(), remaining).toInt())
      if (count < 0) throw EOFException("The archive ends early. Download it again.")
      remaining -= count
      return count
    }

    private fun inflated(b: ByteArray, off: Int, len: Int): Int {
      val inflater = inflater!!
      while (true) {
        val count = try { inflater.inflate(b, off, len) } catch (failure: DataFormatException) { throw ImportException("This archive is damaged.") }
        if (count > 0) return count
        if (inflater.finished()) {
          // The inflater stops inside the last chunk; return the unread bytes for the next header.
          if (inflater.remaining > 0) input.unread(chunk, chunkLength - inflater.remaining, inflater.remaining)
          return -1
        }
        if (inflater.needsDictionary()) throw ImportException("This archive is damaged.")
        if (inflater.needsInput()) {
          chunkLength = input.read(chunk, 0, chunk.size)
          if (chunkLength < 0) throw EOFException("The archive ends early. Download it again.")
          inflater.setInput(chunk, 0, chunkLength)
        }
      }
    }

    private fun finish() {
      done = true
      inflater?.end()
      if (deferred) {
        var first = u32(bytes(4), 0)
        if (first == DESCRIPTOR) first = u32(bytes(4), 0)
        crc = first
        val sizes = bytes(if (zip64) 16 else 8)
        size = if (zip64) u64(sizes, 8) else u32(sizes, 4)
      }
      if (checksum.value != crc || produced != size) throw ImportException("This archive is damaged. Download it again.")
    }
  }

  private fun signature(): Long? {
    val first = input.read()
    if (first < 0) return null
    input.unread(first)
    return u32(bytes(4), 0)
  }

  private fun bytes(count: Int): ByteArray {
    val result = ByteArray(count)
    var at = 0
    while (at < count) {
      val read = input.read(result, at, count - at)
      if (read < 0) throw EOFException("The archive ends early. Download it again.")
      at += read
    }
    return result
  }

  private fun u16(b: ByteArray, at: Int) = (b[at].toInt() and 0xFF) or ((b[at + 1].toInt() and 0xFF) shl 8)
  private fun u32(b: ByteArray, at: Int) = u16(b, at).toLong() or (u16(b, at + 2).toLong() shl 16)
  private fun u64(b: ByteArray, at: Int) = u32(b, at) or (u32(b, at + 4) shl 32)
}

object ZipNames {
  private const val BOX = "░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀"
  /** DOS code pages. Windows' built-in ZIP writes names in these unless it marks them UTF-8. */
  val CP437 = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»" + BOX + "αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
  val CP866 = (0x410..0x43F).map { it.toChar() }.joinToString("") + BOX +
    (0x440..0x44F).map { it.toChar() }.joinToString("") + "ЁёЄєЇїЎў°∙·√№¤■ "
  private val unsafe = Regex("[\\u0000-\\u001F\"*:<>?|]")
  private val junkFiles = setOf(".ds_store", "thumbs.db", "desktop.ini")

  fun decode(raw: ByteArray, flags: Int, unicodePath: String?): String {
    if (flags and 0x800 != 0) return String(raw, Charsets.UTF_8)
    if (unicodePath != null) return unicodePath
    if (raw.all { it >= 0 }) return String(raw, Charsets.US_ASCII)
    try {
      return Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(raw)).toString()
    } catch (_: CharacterCodingException) {}
    val table = if (cyrillic(raw)) CP866 else CP437
    return raw.map { val b = it.toInt() and 0xFF; if (b < 0x80) b.toChar() else table[b - 0x80] }.joinToString("")
  }

  /** Russian words are runs of letter bytes; Western DOS names have only scattered accented letters. */
  private fun cyrillic(raw: ByteArray): Boolean {
    var letters = 0; var latin = 0; var run = 0; var longest = 0
    for (byte in raw) {
      val b = byte.toInt() and 0xFF
      if (b in 0x80..0xAF || b in 0xE0..0xF1) { letters++; run++; longest = maxOf(longest, run) } else run = 0
      if (b in 0x41..0x5A || b in 0x61..0x7A) latin++
    }
    return longest >= 3 || (letters > 0 && letters >= latin)
  }

  /** Safe relative path segments, or null for folders and operating-system clutter. */
  fun path(name: String): List<String>? {
    val unified = name.replace('\\', '/')
    if (unified.endsWith("/")) return null
    val parts = unified.split('/').filter { it.isNotEmpty() && it != "." }
    if (parts.any { it == ".." }) throw ImportException("This archive contains unsafe file paths and was not imported.")
    if (parts.isEmpty()) return null
    val file = parts.last()
    if (parts.any { it == "__MACOSX" } || file.startsWith("._") || file.lowercase() in junkFiles) return null
    return parts.map { segment(it) }
  }

  fun segment(value: String) = value.replace(unsafe, "_").trimEnd('.', ' ').trimStart().ifEmpty { "_" }
}
