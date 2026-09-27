package com.evb.folderaudio

import android.app.Activity
import android.content.Intent
import android.os.SystemClock
import android.view.KeyEvent
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.json.JSONArray
import org.json.JSONObject
import org.junit.*
import org.junit.Assert.*
import org.junit.runner.RunWith
import java.util.concurrent.TimeUnit

class PlaybackTestActivity : Activity()

@RunWith(AndroidJUnit4::class)
@UnstableApi
class PlaybackTest {
  private val instrumentation = InstrumentationRegistry.getInstrumentation()
  private val context get() = instrumentation.targetContext
  private lateinit var activity: Activity
  private lateinit var store: LibraryStore
  private fun track(index: Int) = JSONObject().put("id", "track-$index").put("uri", "asset:///chapter-01.wav").put("name", "$index.wav").put("title", "Chapter $index").put("duration", 49000)
  private fun book(id: String = "book") = JSONObject().put("id", id).put("name", "Test book $id").put("path", "Audiobooks/$id").put("root", "test").put("tracks", JSONArray().put(track(1)).put(track(2)))
  private fun point(id: String = "book", position: Long = 12000) = JSONObject().put("bookId", id).put("bookName", "Test book $id").put("trackId", "track-1").put("trackTitle", "Chapter 1").put("trackIndex", 0).put("position", position).put("duration", 49000)
  private fun main(block: () -> Unit) = instrumentation.runOnMainSync(block)
  private fun status(): JSONObject { var value = JSONObject(); main { value = PlaybackService.instance?.status() ?: JSONObject() }; return value }
  private fun await(label: String, condition: () -> Boolean) {
    val deadline = SystemClock.elapsedRealtime() + 10000
    while (SystemClock.elapsedRealtime() < deadline) { if (condition()) return; SystemClock.sleep(50) }
    fail("Timed out: $label; state=${status()}")
  }
  private fun command(action: String, data: JSONObject = JSONObject()) { main { PlaybackService.dispatch(activity, action, data) } }
  @Before fun setUp() {
    context.deleteDatabase("folder-player.db")
    store = LibraryStore(context)
    store.replaceRoot("test", listOf(book(), book("second")))
    store.save(point())
    activity = instrumentation.startActivitySync(Intent(context, PlaybackTestActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }
  @After fun tearDown() {
    main { activity.stopService(Intent(activity, PlaybackService::class.java)); activity.finish() }
    await("service shutdown") { PlaybackService.instance == null }
    store.close()
  }
  @Test fun journalSurvivesDatabaseReopenAndRescan() {
    store.save(point(position = 28000), "Before jump")
    store.save(point(position = 4000))
    store.save(point("second", 21000))
    store.close(); store = LibraryStore(context)
    assertEquals(4000, store.progress("book")!!.getLong("position"))
    assertEquals(21000, store.current().getLong("position"))
    assertEquals(28000, store.undoPoint()!!.getLong("position"))
    store.replaceRoot("test", listOf(book(), book("second")))
    assertEquals(4000, store.progress("book")!!.getLong("position"))
    assertEquals(1, store.history().length())
  }
  @Test fun playbackRestoresPositionAndUndoThenSurvivesServiceRecreation() {
    command("toggle")
    await("playing from saved position") { status().optBoolean("playing") && status().optLong("position") >= 12000 }
    command("pause")
    await("paused") { !status().optBoolean("playing") }
    val before = status().getLong("position")
    command("skip", JSONObject().put("delta", 20000))
    await("twenty second jump") { status().optLong("position") >= before + 19500 }
    command("undo")
    await("undo restores paused position") { !status().optBoolean("loading", true) && kotlin.math.abs(status().optLong("position") - before) < 500 }
    assertFalse(status().optBoolean("playing"))
    main { activity.stopService(Intent(activity, PlaybackService::class.java)) }
    await("service stops") { PlaybackService.instance == null }
    command("toggle")
    await("service resumes same track") { status().optBoolean("playing") && status().optString("trackId") == "track-1" }
    assertTrue(kotlin.math.abs(status().getLong("position") - before) < 1800)
  }
  @Test fun headsetNextIsIgnoredButChapterCompletionAdvances() {
    command("toggle")
    await("playing") { status().optBoolean("playing") }
    val token = SessionToken(context, android.content.ComponentName(context, PlaybackService::class.java))
    lateinit var future: com.google.common.util.concurrent.ListenableFuture<MediaController>
    main { future = MediaController.Builder(context, token).buildAsync() }
    val controller = future.get(10, TimeUnit.SECONDS)
    instrumentation.uiAutomation.adoptShellPermissionIdentity("android.permission.MEDIA_CONTENT_CONTROL")
    try {
      val platformController = context.getSystemService(android.media.session.MediaSessionManager::class.java).getActiveSessions(null).first { it.packageName == context.packageName }
      main {
        platformController.dispatchMediaButtonEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MEDIA_NEXT))
        platformController.dispatchMediaButtonEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_MEDIA_NEXT))
      }
      instrumentation.waitForIdleSync()
      assertEquals("track-1", status().getString("trackId"))
      main { assertFalse(controller.isCommandAvailable(androidx.media3.common.Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)) }
      command("seek", JSONObject().put("position", status().getLong("duration") - 300))
      await("natural chapter progression") { status().optString("trackId") == "track-2" && status().optBoolean("playing") }
    } finally { main { controller.release() }; instrumentation.uiAutomation.dropShellPermissionIdentity() }
  }
  @Test fun failedFileDoesNotOverwriteSavedPosition() {
    val broken = book("missing")
    broken.getJSONArray("tracks").getJSONObject(0).put("uri", "file:///missing-audiobook.mp3")
    store.replaceRoot("test", listOf(book(), broken))
    store.save(point("missing", 28000))
    command("toggle")
    await("missing file error") { !status().isNull("error") && status().has("error") }
    assertEquals(28000, store.current().getLong("position"))
    assertEquals("missing", store.current().getString("bookId"))
  }
  @Test fun mediaSessionCanResumeWithoutOpeningTheReactScreen() {
    val token = SessionToken(context, android.content.ComponentName(context, PlaybackService::class.java))
    lateinit var future: com.google.common.util.concurrent.ListenableFuture<MediaController>
    main { future = MediaController.Builder(context, token).buildAsync() }
    val controller = future.get(10, TimeUnit.SECONDS)
    try {
      main { controller.play() }
      await("media session restores saved playlist") { status().optBoolean("playing") && status().optString("trackId") == "track-1" }
      assertTrue(status().getLong("position") >= 12000)
      assertTrue(status().getLong("position") < 14000)
    } finally { main { controller.release() } }
  }
  @Test fun bookmarkWorksBeforePlaybackHasBeenRestored() {
    command("bookmark")
    await("bookmark of saved position") { store.history().length() == 1 }
    assertEquals("Bookmark", store.history().getJSONObject(0).getString("reason"))
    assertEquals(12000, store.history().getJSONObject(0).getLong("position"))
    assertFalse(status().optBoolean("playing"))
  }
  @Test fun completedBookCanReplayWithOneTap() {
    command("open", JSONObject().put("bookId", "book").put("trackId", "track-2"))
    await("last track playing") { status().optBoolean("playing") }
    command("seek", JSONObject().put("position", status().getLong("duration") - 200))
    await("book completes") {
      val history = store.history()
      (0 until history.length()).any { history.getJSONObject(it).getString("reason") == "Finished track" }
    }
    command("toggle")
    await("one tap replays completed track") { status().optBoolean("playing") && status().optLong("position") < 2000 }
  }
}
