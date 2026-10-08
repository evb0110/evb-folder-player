package com.evb.folderaudio

import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.nio.charset.Charset
import java.util.concurrent.CancellationException
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class FileTarget(dir: File, private val free: Long? = null, private val movable: Boolean = true) : ImportTarget {
  override val root: String = dir.path
  override fun children(directory: String) = File(directory).listFiles()!!.map { ImportNode(it.name, it.path, it.isDirectory) }
  override fun createDirectory(parent: String, name: String) = File(parent, name).also { check(it.mkdir()) }.path
  override fun createFile(parent: String, name: String) = File(parent, name).also { check(it.createNewFile()) }.path
  override fun openOutput(file: String) = FileOutputStream(file)
  override fun freeSpace(file: String) = free
  override fun rename(node: String, name: String) = File(node).let { val to = File(it.parentFile, name); check(it.renameTo(to)); to.path }
  override fun move(node: String, from: String, to: String): String? =
    if (!movable) null else File(node).let { val moved = File(to, it.name); if (it.renameTo(moved)) moved.path else null }
  override fun delete(node: String) { File(node).deleteRecursively() }
}

class ArchiveImporterTest {
  @get:Rule val temp = TemporaryFolder()

  private fun zip(charset: Charset = Charsets.UTF_8, stored: Boolean = false, vararg files: Pair<String, ByteArray>): ByteArray {
    val bytes = ByteArrayOutputStream()
    ZipOutputStream(bytes, charset).use { out ->
      for ((name, data) in files) {
        val entry = ZipEntry(name)
        if (stored) { entry.method = ZipEntry.STORED; entry.size = data.size.toLong(); entry.crc = CRC32().apply { update(data) }.value }
        out.putNextEntry(entry); out.write(data); out.closeEntry()
      }
    }
    return bytes.toByteArray()
  }
  private fun audio(seed: Int) = ByteArray(40_000).also { java.util.Random(seed.toLong()).nextBytes(it) }
  private fun tree(dir: File): List<String> = dir.walkTopDown().filter { it != dir }.map { it.relativeTo(dir).path }.sorted().toList()
  private fun import(archive: ByteArray, name: String = "Book.zip", target: ImportTarget = FileTarget(temp.root), cancelled: () -> Boolean = { false }, slack: Long = 1L shl 29) =
    ArchiveImporter(target, cancelled, slack = slack).import(ByteArrayInputStream(archive), name, archive.size.toLong())

  @Test fun codePageTablesMatchTheJdkCharsets() {
    val high = ByteArray(128) { (it + 0x80).toByte() }
    assertEquals(String(high, Charset.forName("IBM437")), ZipNames.CP437)
    assertEquals(String(high, Charset.forName("IBM866")), ZipNames.CP866)
  }

  @Test fun windowsCyrillicNamesAreDecodedFromTheDosCodePage() {
    val archive = zip(Charset.forName("IBM866"), false, "Война и мир/01 Глава первая.mp3" to audio(1), "Война и мир/02 Глава вторая.mp3" to audio(2))
    val result = import(archive)
    assertEquals("Война и мир", result.folder)
    assertEquals(listOf("Война и мир", "Война и мир/01 Глава первая.mp3", "Война и мир/02 Глава вторая.mp3"), tree(temp.root))
    assertArrayEquals(audio(2), File(temp.root, "Война и мир/02 Глава вторая.mp3").readBytes())
  }

  @Test fun westernDosNamesAndUtf8NamesKeepTheirAccents() {
    assertEquals("Café Müller.mp3", ZipNames.decode("Café Müller.mp3".toByteArray(Charset.forName("IBM437")), 0, null))
    assertEquals("Café Müller.mp3", ZipNames.decode("Café Müller.mp3".toByteArray(), 0, null))
    assertEquals("Ты.mp3", ZipNames.decode("Ты.mp3".toByteArray(Charset.forName("IBM866")), 0, null))
    assertEquals("«Ёлка».mp3", ZipNames.decode("«Ёлка».mp3".toByteArray(), 0x800, null))
  }

  @Test fun unicodePathFieldOverridesTheLegacyName() {
    val legacy = "????.mp3".toByteArray()
    val unicode = "Сказка.mp3".toByteArray()
    val crc = CRC32().apply { update(legacy) }.value
    val body = byteArrayOf(1) + ByteArray(4) { (crc shr (8 * it)).toByte() } + unicode
    val extra = byteArrayOf(0x75, 0x70, body.size.toByte(), 0) + body
    val bytes = ByteArrayOutputStream()
    ZipOutputStream(bytes, Charsets.US_ASCII).use { out ->
      out.putNextEntry(ZipEntry("????.mp3").apply { setExtra(extra) }); out.write(audio(3)); out.closeEntry()
    }
    import(bytes.toByteArray(), "Tale.zip")
    assertEquals(listOf("Tale", "Tale/Сказка.mp3"), tree(temp.root))
  }

  @Test fun storedAndDeflatedEntriesRoundTripAndClutterIsSkipped() {
    for (stored in listOf(true, false)) {
      val dir = temp.newFolder()
      val archive = zip(Charsets.UTF_8, stored, "a.mp3" to audio(1), "__MACOSX/._a.mp3" to byteArrayOf(1), ".DS_Store" to byteArrayOf(2),
        "CD 2/b.m4b" to audio(2), "cover.jpg" to byteArrayOf(3, 4))
      val result = import(archive, "Two parts.zip", FileTarget(dir))
      assertEquals("Two parts", result.folder)
      assertEquals(listOf("Two parts", "Two parts/CD 2", "Two parts/CD 2/b.m4b", "Two parts/a.mp3", "Two parts/cover.jpg"), tree(dir))
      assertArrayEquals(audio(2), File(dir, "Two parts/CD 2/b.m4b").readBytes())
      assertEquals(2, result.audio)
    }
  }

  @Test fun existingFoldersAreNeverReplaced() {
    File(temp.root, "Book").mkdir(); File(temp.root, "Book/mine.mp3").writeText("keep")
    val result = import(zip(files = arrayOf("Book/01.mp3" to audio(1))))
    assertEquals("Book (2)", result.folder)
    assertEquals("keep", File(temp.root, "Book/mine.mp3").readText())
    assertTrue(File(temp.root, "Book (2)/01.mp3").isFile)
  }

  @Test fun storageWithoutMoveKeepsTheArchiveFolderAroundTheBook() {
    val result = import(zip(files = arrayOf("Book/01.mp3" to audio(1))), "Shared.zip", FileTarget(temp.root, movable = false))
    assertEquals("Shared", result.folder)
    assertEquals(listOf("Shared", "Shared/Book", "Shared/Book/01.mp3"), tree(temp.root))
  }

  private fun assertFailsCleanly(message: String, archive: ByteArray, target: ImportTarget = FileTarget(temp.root), slack: Long = 1L shl 29) {
    File(temp.root, "Existing").mkdir()
    val failure = assertThrows(ImportException::class.java) { import(archive, target = target, slack = slack) }
    assertTrue(failure.message, failure.message!!.contains(message))
    assertEquals(listOf("Existing"), tree(temp.root))
  }

  @Test fun unsafePathsAreRejectedWithoutWritingAnything() =
    assertFailsCleanly("unsafe", zip(files = arrayOf("ok.mp3" to audio(1), "../escape.mp3" to audio(2))))

  @Test fun archivesWithoutAudioAreRejected() = assertFailsCleanly("no audio", zip(files = arrayOf("notes.txt" to byteArrayOf(1))))

  @Test fun otherFilesAreNotArchives() = assertFailsCleanly("not a ZIP", "%PDF-1.7 not a zip".toByteArray())

  @Test fun damagedDataIsDetected() {
    val archive = zip(stored = true, files = arrayOf("a.mp3" to audio(1)))
    archive[30 + "a.mp3".length + 100] = (archive[30 + "a.mp3".length + 100] + 1).toByte()
    assertFailsCleanly("damaged", archive)
  }

  @Test fun truncatedDownloadsAreDetected() {
    val archive = zip(files = arrayOf("a.mp3" to audio(1), "b.mp3" to audio(2)))
    File(temp.root, "Existing").mkdir()
    assertThrows(Exception::class.java) { import(archive.copyOf(archive.size / 2)) }
    assertEquals(listOf("Existing"), tree(temp.root))
  }

  @Test fun passwordProtectedArchivesAreRejected() {
    val archive = zip(stored = true, files = arrayOf("a.mp3" to audio(1)))
    archive[6] = (archive[6].toInt() or 1).toByte()
    assertFailsCleanly("password", archive)
  }

  @Test fun insufficientSpaceStopsBeforeWriting() =
    assertFailsCleanly("Not enough free space", zip(files = arrayOf("a.mp3" to audio(1))), FileTarget(temp.root, free = 1000))

  @Test fun archivesThatExpandFarBeyondTheirSizeAreRejected() =
    assertFailsCleanly("far more data", zip(files = arrayOf("a.mp3" to ByteArray(4 * 1024 * 1024))), slack = 1024 * 1024)

  @Test fun cancellingRemovesThePartialImport() {
    var reads = 0
    File(temp.root, "Existing").mkdir()
    assertThrows(CancellationException::class.java) { import(zip(files = arrayOf("a.mp3" to audio(1), "b.mp3" to audio(2))), cancelled = { ++reads > 3 }) }
    assertEquals(listOf("Existing"), tree(temp.root))
  }

  @Test fun abandonedImportFoldersAreCleanedUp() {
    File(temp.root, ArchiveImporter.TEMP_PREFIX + "1/part.mp3").apply { parentFile!!.mkdirs(); writeText("x") }
    import(zip(files = arrayOf("Book/01.mp3" to audio(1))))
    assertEquals(listOf("Book", "Book/01.mp3"), tree(temp.root))
  }
}
