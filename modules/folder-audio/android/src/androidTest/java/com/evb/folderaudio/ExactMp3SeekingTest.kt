package com.evb.folderaudio

import androidx.media3.common.C
import androidx.media3.common.DataReader
import androidx.media3.common.Format
import androidx.media3.common.util.ParsableByteArray
import androidx.media3.common.util.UnstableApi
import androidx.media3.extractor.DefaultExtractorInput
import androidx.media3.extractor.Extractor
import androidx.media3.extractor.ExtractorOutput
import androidx.media3.extractor.PositionHolder
import androidx.media3.extractor.SeekMap
import androidx.media3.extractor.TrackOutput
import androidx.media3.extractor.mp3.Mp3Extractor
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * coarse-vbr.mp3 is 6 s of loud noise, then 14 s of a quiet tone, encoded at a variable bitrate.
 * Its Xing table spreads time evenly over the bytes, as a table rounded to 1/256 of a long
 * audiobook does over many minutes, so Media3's own seek lands seconds away from the target.
 */
@RunWith(AndroidJUnit4::class)
@UnstableApi
class ExactMp3SeekingTest {
  @get:Rule val temp = TemporaryFolder()
  private val fixture by lazy {
    val context = InstrumentationRegistry.getInstrumentation().targetContext
    File(temp.root, "coarse-vbr.mp3").also { file -> context.assets.open("coarse-vbr.mp3").use { input -> file.outputStream().use { input.copyTo(it) } } }
  }
  private val bytes by lazy { fixture.readBytes() }

  private class Sample(val timeUs: Long, val data: ByteArray)
  private class Capture : ExtractorOutput, TrackOutput {
    var seekMap: SeekMap? = null
    val samples = mutableListOf<Sample>()
    private val pending = ByteArrayOutputStream()
    fun reset() { samples.clear(); pending.reset() }
    override fun track(id: Int, type: Int) = this
    override fun endTracks() = Unit
    override fun seekMap(seekMap: SeekMap) { this.seekMap = seekMap }
    override fun format(format: Format) = Unit
    override fun sampleData(input: DataReader, length: Int, allowEndOfInput: Boolean, sampleDataPart: Int): Int {
      val buffer = ByteArray(length)
      val read = input.read(buffer, 0, length)
      if (read != C.RESULT_END_OF_INPUT) pending.write(buffer, 0, read)
      return read
    }
    override fun sampleData(data: ParsableByteArray, length: Int, sampleDataPart: Int) {
      val buffer = ByteArray(length); data.readBytes(buffer, 0, length); pending.write(buffer)
    }
    override fun sampleMetadata(timeUs: Long, flags: Int, size: Int, offset: Int, cryptoData: TrackOutput.CryptoData?) {
      samples.add(Sample(timeUs, pending.toByteArray())); pending.reset()
    }
  }

  private fun input(from: Long) = DefaultExtractorInput(object : DataReader {
    var at = from.toInt()
    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
      if (at >= bytes.size) return C.RESULT_END_OF_INPUT
      val count = minOf(length, bytes.size - at)
      System.arraycopy(bytes, at, buffer, offset, count); at += count
      return count
    }
  }, from, bytes.size.toLong())
  private fun run(extractor: Extractor, output: Capture, from: Long, until: () -> Boolean) {
    val input = input(from); val holder = PositionHolder()
    while (!until()) {
      val result = extractor.read(input, holder)
      if (result == Extractor.RESULT_END_OF_INPUT) break
      assertEquals(Extractor.RESULT_CONTINUE, result)
    }
  }
  private fun exact(file: File = fixture) = ExactMp3Extractor(Mp3Extractor()) { Mp3FrameIndex.cached(file.path) { FileChannelSlice.of(file) } }
  /** Every frame with the time Media3 gives it when reading from the start, which involves no seek table. */
  private val frames: List<Sample> by lazy {
    val output = Capture(); val extractor = Mp3Extractor().also { it.init(output) }
    run(extractor, output, 0) { false }
    output.samples.toList()
  }
  /** Where each frame starts in the file. Frames follow each other from the first one. */
  private val starts: List<Long> by lazy {
    val first = (0..bytes.size - frames[0].data.size).first { at -> frames[0].data.indices.all { bytes[at + it] == frames[0].data[it] } }
    frames.runningFold(first.toLong()) { at, frame -> at + frame.data.size }.dropLast(1)
  }
  /** Seeks to [timeUs] and returns the time Media3 reports for the first frame and the time that frame really has. */
  private fun seek(extractor: Extractor, timeUs: Long): Pair<Long, Long> {
    val output = Capture(); extractor.init(output)
    run(extractor, output, 0) { output.seekMap != null }
    output.reset()
    val point = output.seekMap!!.getSeekPoints(timeUs).first
    extractor.seek(point.position, timeUs)
    run(extractor, output, point.position) { output.samples.size >= 3 }
    // The quiet tone repeats identical frames, so the frame is the first match at or after the seek position.
    val heard = frames.indices.first { i ->
      starts[i] >= point.position && i + 2 < frames.size && (0..2).all { frames[i + it].data.contentEquals(output.samples[it].data) }
    }
    return output.samples[0].timeUs to frames[heard].timeUs
  }

  @Test fun media3AloneResumesSecondsAwayFromTheReportedTime() {
    val (reported, real) = seek(Mp3Extractor(), 15_000_000)
    assertEquals(15_000_000.0, reported.toDouble(), 200_000.0)
    assertTrue("Audio from $real us", real < 10_000_000)
  }

  @Test fun exactSeekStartsAtTheFrameHoldingTheTargetAndReportsItsRealTime() {
    for (target in listOf(1_000_000L, 5_500_000, 6_000_000, 9_250_000, 15_000_000, 19_000_000)) {
      val (reported, real) = seek(exact(), target)
      assertEquals("Reported time for $target", real, reported)
      // The player starts from a seek point at most eight frames (209 ms) early and decodes up to the target.
      assertTrue("Audio from $real for $target", real <= target && target - real <= 8 * 26_200)
    }
  }

  @Test fun exactIndexMatchesMedia3DurationAndFrames() {
    val index = Mp3FrameIndex.cached(fixture.path) { FileChannelSlice.of(fixture) }!!
    assertEquals((frames.last().timeUs + 26_122).toDouble(), index.durationUs.toDouble(), 2.0)
    for (k in frames.indices step 37) {
      val point = index.getSeekPoints(frames[k].timeUs).first
      assertEquals(frames[k - k % 8].timeUs, point.timeUs)
    }
  }

  @Test fun constantBitrateFilesKeepMedia3Seeking() {
    val info = bytes.copyOf()
    val at = String(info, Charsets.ISO_8859_1).indexOf("Xing")
    "Info".toByteArray().copyInto(info, at)
    val file = temp.newFile("info.mp3").apply { writeBytes(info) }
    assertNull(Mp3FrameIndex.cached(file.path) { FileChannelSlice.of(file) })
  }
}
