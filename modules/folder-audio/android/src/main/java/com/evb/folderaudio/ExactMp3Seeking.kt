package com.evb.folderaudio

import android.content.Context
import android.net.Uri
import androidx.annotation.OptIn
import androidx.media3.common.C
import androidx.media3.common.DataReader
import androidx.media3.common.Format
import androidx.media3.common.util.ExperimentalApi
import androidx.media3.common.util.ParsableByteArray
import androidx.media3.common.util.UnstableApi
import androidx.media3.extractor.DefaultExtractorsFactory
import androidx.media3.extractor.Extractor
import androidx.media3.extractor.ExtractorInput
import androidx.media3.extractor.ExtractorOutput
import androidx.media3.extractor.ExtractorsFactory
import androidx.media3.extractor.MpegAudioUtil
import androidx.media3.extractor.PositionHolder
import androidx.media3.extractor.SeekMap
import androidx.media3.extractor.SeekPoint
import androidx.media3.extractor.TrackOutput
import androidx.media3.extractor.mp3.Mp3Extractor
import androidx.media3.extractor.text.SubtitleParser
import java.io.File
import java.io.FileInputStream
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.channels.FileChannel

/*
 * Media3 seeks in a variable-bitrate MP3 through the file's Xing table: 100 points, each a byte
 * offset rounded to 1/256 of the file. Between points it guesses, and the audio it starts can be
 * 1/256 of the file away from the time it reports, which is minutes in a long audiobook. The
 * player keeps reporting the requested time, so the saved position looks right while the voice
 * resumes somewhere else. These classes find every frame once per file and seek to the frame
 * that really holds the saved time.
 */

/** Extractors as Media3 builds them, with exact seeking for variable-bitrate MP3s. */
@UnstableApi
@OptIn(ExperimentalApi::class)
class ExactSeekingExtractorsFactory(private val open: (Uri) -> FileChannelSlice?) : ExtractorsFactory {
  constructor(context: Context) : this({ uri -> FileChannelSlice.open(context, uri) })
  private val defaults = DefaultExtractorsFactory()
  override fun createExtractors(): Array<Extractor> = defaults.createExtractors()
  override fun createExtractors(uri: Uri, responseHeaders: Map<String, List<String>>): Array<Extractor> =
    defaults.createExtractors(uri, responseHeaders).map { extractor ->
      if (extractor.underlyingImplementation is Mp3Extractor) ExactMp3Extractor(extractor) { Mp3FrameIndex.cached(uri.toString()) { open(uri) } }
      else extractor
    }.toTypedArray()
  @Deprecated("Forwarded to Media3's factory.")
  override fun experimentalSetTextTrackTranscodingEnabled(enabled: Boolean): ExtractorsFactory {
    @Suppress("DEPRECATION") defaults.experimentalSetTextTrackTranscodingEnabled(enabled); return this
  }
  override fun setSubtitleParserFactory(factory: SubtitleParser.Factory): ExtractorsFactory { defaults.setSubtitleParserFactory(factory); return this }
  override fun experimentalSetCodecsToParseWithinGopSampleDependencies(codecFlags: Int): ExtractorsFactory {
    defaults.experimentalSetCodecsToParseWithinGopSampleDependencies(codecFlags); return this
  }
  override fun setParseHagcMetadata(parseHagcMetadata: Boolean): ExtractorsFactory { defaults.setParseHagcMetadata(parseHagcMetadata); return this }
}

/**
 * Media3's MP3 extractor with an exact seek map. The extractor still reads the frames, but it
 * timestamps the first frame after a seek from its own table, so the timestamps are moved to the
 * frame's real time until the next seek.
 */
@UnstableApi
class ExactMp3Extractor(private val inner: Extractor, private val index: () -> Mp3FrameIndex?) : Extractor {
  private var exact: Mp3FrameIndex? = null
  private var indexed = false
  /** The real time of the frame a seek starts at, until its first sample arrives. */
  private var startUs: Long? = null
  /** Added to the inner extractor's timestamps since the last seek. */
  private var shiftUs = 0L

  override fun sniff(input: ExtractorInput) = inner.sniff(input)
  override fun getSniffFailureDetails() = inner.sniffFailureDetails
  override fun init(output: ExtractorOutput) = inner.init(object : ExtractorOutput {
    override fun track(id: Int, type: Int): TrackOutput = Retimed(output.track(id, type))
    override fun endTracks() = output.endTracks()
    override fun seekMap(seekMap: SeekMap) {
      if (!indexed) { indexed = true; exact = if (seekMap.isSeekable) runCatching { index() }.getOrNull() else null }
      output.seekMap(exact ?: seekMap)
    }
  })
  override fun read(input: ExtractorInput, seekPosition: PositionHolder) = inner.read(input, seekPosition)
  override fun seek(position: Long, timeUs: Long) {
    inner.seek(position, timeUs)
    shiftUs = 0
    startUs = exact?.timeAt(position)
  }
  override fun release() = inner.release()
  override fun getUnderlyingImplementation(): Extractor = inner.underlyingImplementation

  private inner class Retimed(private val track: TrackOutput) : TrackOutput {
    override fun format(format: Format) = track.format(format)
    override fun durationUs(durationUs: Long) = track.durationUs(durationUs)
    override fun sampleData(input: DataReader, length: Int, allowEndOfInput: Boolean, sampleDataPart: Int) =
      track.sampleData(input, length, allowEndOfInput, sampleDataPart)
    override fun sampleData(data: ParsableByteArray, length: Int, sampleDataPart: Int) = track.sampleData(data, length, sampleDataPart)
    override fun sampleMetadata(timeUs: Long, flags: Int, size: Int, offset: Int, cryptoData: TrackOutput.CryptoData?) {
      startUs?.let { shiftUs = it - timeUs; startUs = null }
      track.sampleMetadata(timeUs + shiftUs, flags, size, offset, cryptoData)
    }
  }
}

/** Positional reads from part of a file: a whole document, or an audio file stored inside the APK. */
class FileChannelSlice(private val channel: FileChannel, private val start: Long, val length: Long, private val closeable: AutoCloseable) : AutoCloseable {
  fun read(buffer: ByteBuffer, position: Long) = channel.read(buffer, start + position)
  override fun close() = closeable.close()
  companion object {
    fun of(file: File): FileChannelSlice { val access = RandomAccessFile(file, "r"); return FileChannelSlice(access.channel, 0, access.length(), access) }
    fun open(context: Context, uri: Uri): FileChannelSlice? = when (uri.scheme) {
      null, "file" -> of(File(requireNotNull(uri.path)))
      "asset" -> context.assets.openFd(requireNotNull(uri.path).removePrefix("/")).let { fd ->
        FileChannelSlice(FileInputStream(fd.fileDescriptor).channel, fd.startOffset, fd.length, fd)
      }
      else -> context.contentResolver.openFileDescriptor(uri, "r")?.let { fd ->
        val channel = FileInputStream(fd.fileDescriptor).channel
        FileChannelSlice(channel, 0, fd.statSize.takeIf { it >= 0 } ?: channel.size(), fd)
      }
    }
  }
}

/** Where every eighth audio frame of an MP3 starts, and how many samples come before it. */
@UnstableApi
class Mp3FrameIndex private constructor(
  private val positions: LongArray,
  private val samples: LongArray,
  private val sampleRate: Int,
  totalSamples: Long,
) : SeekMap {
  private val totalUs = totalSamples * C.MICROS_PER_SECOND / sampleRate
  private fun timeUs(point: Int) = samples[point] * C.MICROS_PER_SECOND / sampleRate
  private fun point(index: Int) = SeekPoint(timeUs(index), positions[index])
  /** The real time of a frame this index points to. */
  fun timeAt(position: Long): Long? = positions.binarySearch(position).takeIf { it >= 0 }?.let { timeUs(it) }
  override fun isSeekable() = true
  override fun getDurationUs() = totalUs
  override fun getSeekPoints(timeUs: Long): SeekMap.SeekPoints {
    // The last point that starts at or before the target.
    var low = 0; var high = positions.size - 1
    while (low < high) { val middle = (low + high + 1) / 2; if (timeUs(middle) <= timeUs) low = middle else high = middle - 1 }
    val before = low
    val first = point(before)
    return if (first.timeUs == timeUs || before + 1 >= positions.size) SeekMap.SeekPoints(first)
    else SeekMap.SeekPoints(first, point(before + 1))
  }

  companion object {
    private const val STEP = 8
    /** Media3 searches as far for the first frame. */
    private const val MAX_SEARCH = 1 shl 17
    /** Without a Xing or VBRI frame, this many frames at one bitrate mean the file is constant bitrate. */
    private const val CBR_FRAMES = 300
    /** Version, layer and sample rate, the bits Media3 requires to match between frames. */
    private const val HEADER_MASK = 0xFFFE0C00.toInt()
    private const val XING = 0x58696e67
    private const val INFO = 0x496e666f
    private const val VBRI = 0x56425249
    private val cache = object : LinkedHashMap<String, Mp3FrameIndex>(4, 0.75f, true) {
      override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Mp3FrameIndex>) = size > 4
    }

    /** The index for [key], built from [open] once per process. Null for constant-bitrate files, which Media3 seeks exactly. */
    fun cached(key: String, open: () -> FileChannelSlice?): Mp3FrameIndex? {
      val slice = open() ?: return null
      return slice.use { file ->
        val name = "$key#${file.length}"
        synchronized(cache) { cache[name] }?.let { return it }
        scan(file)?.also { synchronized(cache) { cache[name] = it } }
      }
    }

    fun scan(file: FileChannelSlice): Mp3FrameIndex? {
      val bytes = Bytes(file)
      var at = 0L
      while (bytes.int(at)?.ushr(8) == 0x494433) { // "ID3"
        val size = (0 until 4).fold(0L) { sum, i -> (sum shl 7) or (bytes.byte(at + 6 + i).toLong() and 0x7f) }
        val footer = if (bytes.byte(at + 5).toInt() and 0x10 != 0) 10 else 0
        at += 10 + size + footer
      }
      at = sync(bytes, at) ?: return null
      val header = MpegAudioUtil.Header().apply { setForHeaderData(bytes.int(at)!!) }
      val xingBase = if (header.version and 1 != 0) (if (header.channels != 1) 36 else 21) else (if (header.channels != 1) 21 else 13)
      val tag = if (header.frameSize >= xingBase + 4) bytes.int(at + xingBase) else null
      var variable: Boolean? = when {
        tag == XING -> true
        tag == INFO -> return null
        header.frameSize >= 40 && bytes.int(at + 36) == VBRI -> true
        else -> null
      }
      if (variable == true) at += header.frameSize
      val sampleRate = header.sampleRate
      val positions = Growing(); val samples = Growing()
      var reference = bytes.int(at) ?: return null
      val firstBitrate = (reference ushr 12) and 0xf
      var frames = 0L; var total = 0L
      while (true) {
        val data = bytes.int(at) ?: break
        val size = MpegAudioUtil.getFrameSize(data)
        if ((data and HEADER_MASK) == (reference and HEADER_MASK) && size != C.LENGTH_UNSET) {
          if (frames % STEP == 0L) { positions.add(at); samples.add(total) }
          if (variable == null && (data ushr 12) and 0xf != firstBitrate) variable = true
          total += MpegAudioUtil.parseMpegAudioFrameSampleCount(data); frames++; at += size
          if (variable == null && frames >= CBR_FRAMES) return null
        } else {
          // Media3 also skips damaged bytes and continues at the next run of matching frames.
          at = sync(bytes, at + 1) ?: break
          reference = bytes.int(at)!!
          if (MpegAudioUtil.Header().apply { setForHeaderData(reference) }.sampleRate != sampleRate) return null
        }
      }
      if (variable != true || positions.size == 0) return null
      return Mp3FrameIndex(positions.toArray(), samples.toArray(), sampleRate, total)
    }

    /** The next position with four consecutive matching frame headers, or fewer that end the file. */
    private fun sync(bytes: Bytes, from: Long): Long? {
      var start = from
      while (start < from + MAX_SEARCH) {
        val first = bytes.int(start) ?: return null
        if (MpegAudioUtil.getFrameSize(first) != C.LENGTH_UNSET) {
          var next = start; var matched = 0
          while (matched < 4) {
            val data = bytes.int(next) ?: break
            val size = MpegAudioUtil.getFrameSize(data)
            if ((data and HEADER_MASK) != (first and HEADER_MASK) || size == C.LENGTH_UNSET) break
            matched++; next += size
          }
          if (matched == 4 || (matched > 0 && bytes.int(next) == null)) return start
        }
        start++
      }
      return null
    }
  }

  private class Growing {
    private var values = LongArray(1024)
    var size = 0
    fun add(value: Long) { if (size == values.size) values = values.copyOf(size * 2); values[size++] = value }
    fun toArray(): LongArray = values.copyOf(size)
  }

  /** Reads ahead in 256 KiB windows, since the scan moves forward a few bytes at a time. */
  private class Bytes(private val file: FileChannelSlice) {
    private val buffer = ByteBuffer.allocate(1 shl 18)
    private var start = 0L
    private var end = 0L
    fun int(at: Long): Int? {
      if (at < 0 || at + 4 > file.length) return null
      window(at, 4)
      return buffer.getInt((at - start).toInt())
    }
    fun byte(at: Long): Byte { window(at, 1); return buffer.get((at - start).toInt()) }
    private fun window(at: Long, size: Int) {
      if (at >= start && at + size <= end) return
      buffer.clear()
      while (buffer.hasRemaining() && at + buffer.position() < file.length) {
        if (file.read(buffer, at + buffer.position()) <= 0) break
      }
      start = at; end = at + buffer.position()
      if (at + size > end) throw java.io.EOFException()
    }
  }
}
