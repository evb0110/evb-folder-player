package com.evb.folderaudio

import android.app.PendingIntent
import android.content.Intent
import android.content.Context
import android.media.audiofx.LoudnessEnhancer
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import androidx.media3.common.*
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.CommandButton
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONObject
import kotlin.math.abs

@UnstableApi
class PlaybackService : MediaSessionService() {
  companion object {
    @Volatile var instance: PlaybackService? = null
    private val pendingCommands = mutableListOf<Pair<String, JSONObject>>()
    /** Called on the main thread. Private in-process commands never trust exported Intent extras. */
    fun dispatch(context: Context, action: String, data: JSONObject) {
      instance?.let { it.command(action, data); return }
      val command = action to data
      pendingCommands.add(command)
      try { context.startService(Intent(context, PlaybackService::class.java)) }
      catch (failure: Exception) { pendingCommands.remove(command); throw failure }
    }
  }
  private lateinit var store: LibraryStore
  private lateinit var player: ExoPlayer
  private var session: MediaSession? = null
  private var book: JSONObject? = null
  private val handler = Handler(Looper.getMainLooper())
  private var expectedPosition: Long? = null
  private var pendingUndoId: Long? = null
  private var changing = false
  private var error: String? = null
  private var lastSave = 0L
  private var lastHeadsetToggle = 0L
  private var sleepAt = 0L
  /** Decibels added above the system volume; 0 detaches the effect. */
  private var boost = 0
  /** Internal, with [audioSessionId] and [platformToken], for the instrumentation test. */
  internal var enhancer: LoudnessEnhancer? = null
    private set
  internal fun audioSessionId() = player.audioSessionId
  internal fun platformToken() = session?.platformToken

  override fun onCreate() {
    super.onCreate()
    store = LibraryStore(applicationContext)
    player = ExoPlayer.Builder(this)
      .setAudioAttributes(AudioAttributes.Builder().setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).setUsage(C.USAGE_MEDIA).build(), true)
      .setHandleAudioBecomingNoisy(true)
      .setWakeMode(C.WAKE_MODE_LOCAL)
      .setSeekBackIncrementMs(20000).setSeekForwardIncrementMs(20000).build()
    player.setPlaybackSpeed(store.read("speed", "1.0").toFloatOrNull()?.coerceIn(0.5f, 2.5f) ?: 1f)
    boost = store.read("boost", "0").toIntOrNull()?.coerceIn(0, 12) ?: 0
    player.addListener(object : Player.Listener {
      override fun onPlaybackStateChanged(state: Int) {
        if (state == Player.STATE_READY && expectedPosition != null) {
          val wanted = minOf(expectedPosition!!, player.duration.takeIf { it > 0 } ?: Long.MAX_VALUE)
          if (abs(player.currentPosition - wanted) > 1800) {
            error = "The file could not resume at its saved position. Your previous position is safe in History."
            player.pause()
            return
          }
          expectedPosition = null
          persist()
          pendingUndoId?.let { store.markUndone(it) }; pendingUndoId = null
        }
        if (state == Player.STATE_ENDED) persist("Finished track")
      }
      override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
        if (!changing && expectedPosition == null) persist(if (playWhenReady) "Listening" else "Paused")
      }
      override fun onPositionDiscontinuity(oldPosition: Player.PositionInfo, newPosition: Player.PositionInfo, reason: Int) {
        if (changing || expectedPosition != null || error != null) return
        if (reason == Player.DISCONTINUITY_REASON_SEEK) {
          val previous = point(oldPosition.mediaItemIndex, oldPosition.positionMs)
          if (previous != null) store.save(previous, "Before jump")
        }
        if (reason == Player.DISCONTINUITY_REASON_AUTO_TRANSITION) {
          val previous = point(oldPosition.mediaItemIndex, oldPosition.positionMs)
          if (previous != null) store.save(previous, "Chapter finished")
        }
        persist()
      }
      // ExoPlayer assigns its audio session asynchronously; the effect must follow it.
      override fun onAudioSessionIdChanged(audioSessionId: Int) { enhancer?.release(); enhancer = null; applyBoost() }
      override fun onPlayerError(failure: PlaybackException) {
        error = "Cannot play this file. Check that it is still on your phone and that folder access is allowed. (${failure.errorCodeName})"
        // Never replace a known-good checkpoint with a failed player's zero position.
      }
    })
    val protectedPlayer = object : ForwardingPlayer(player) {
      override fun getAvailableCommands(): Player.Commands = super.getAvailableCommands().buildUpon()
        .remove(Player.COMMAND_SEEK_TO_NEXT).remove(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
        .remove(Player.COMMAND_SEEK_TO_PREVIOUS).remove(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
        .remove(Player.COMMAND_SEEK_TO_MEDIA_ITEM).build()
      override fun isCommandAvailable(command: Int) = availableCommands.contains(command)
      override fun seekToNext() = Unit
      override fun seekToNextMediaItem() = Unit
      override fun seekToPrevious() = Unit
      override fun seekToPreviousMediaItem() = Unit
      // Lock-screen and notification jumps take the same path as the app's, including a seek during restore.
      override fun seekBack() = command("skip", JSONObject().put("delta", -seekBackIncrement))
      override fun seekForward() = command("skip", JSONObject().put("delta", seekForwardIncrement))
      override fun seekTo(positionMs: Long) = command("seek", JSONObject().put("position", positionMs))
    }
    val builder = MediaSession.Builder(this, protectedPlayer).setCallback(object : MediaSession.Callback {
      override fun onConnect(session: MediaSession, controller: MediaSession.ControllerInfo): MediaSession.ConnectionResult {
        if (!controller.isTrusted) return MediaSession.ConnectionResult.reject()
        // The session itself needs playlist commands for cold resumption. External controllers do not.
        // The media notification controller, whose commands the lock screen also uses, can connect
        // before a book is loaded, so grant from all commands; the player still limits them to what
        // it can do at each moment.
        val remoteCommands = MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS.buildUpon()
          .remove(Player.COMMAND_CHANGE_MEDIA_ITEMS).remove(Player.COMMAND_SET_MEDIA_ITEM).build()
        return MediaSession.ConnectionResult.AcceptedResultBuilder(session).setAvailablePlayerCommands(remoteCommands).build()
      }
      override fun onMediaButtonEvent(session: MediaSession, controllerInfo: MediaSession.ControllerInfo, intent: Intent): Boolean {
        @Suppress("DEPRECATION") val key = intent.getParcelableExtra<KeyEvent>(Intent.EXTRA_KEY_EVENT) ?: return false
        if (key.keyCode == KeyEvent.KEYCODE_MEDIA_NEXT || key.keyCode == KeyEvent.KEYCODE_MEDIA_PREVIOUS) return true
        if (key.keyCode == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE || key.keyCode == KeyEvent.KEYCODE_HEADSETHOOK) {
          if (key.action == KeyEvent.ACTION_DOWN && key.repeatCount == 0) {
            val now = SystemClock.elapsedRealtime()
            if (now - lastHeadsetToggle > 400) { lastHeadsetToggle = now; toggle() }
          }
          return true
        }
        return false
      }
      override fun onPlaybackResumption(session: MediaSession, controller: MediaSession.ControllerInfo, isForPlayback: Boolean): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
        return try {
          val saved = store.current()
          val target = store.book(saved.getString("bookId")) ?: error("The saved folder is unavailable")
          val items = items(target)
          val index = items.indexOfFirst { it.mediaId == saved.optString("trackId") }
          require(index >= 0) { "The saved track is unavailable" }
          if (isForPlayback) {
            book = target; error = null; expectedPosition = saved.optLong("position")
            store.save(saved, "Resumed from headphones")
          }
          Futures.immediateFuture(MediaSession.MediaItemsWithStartPosition(items, index, saved.optLong("position")))
        } catch (failure: Exception) { Futures.immediateFailedFuture(failure) }
      }
    })
    // 20-second jumps beside play/pause on the lock screen and in the media notification.
    builder.setMediaButtonPreferences(listOf(
      CommandButton.Builder(CommandButton.ICON_SKIP_BACK).setPlayerCommand(Player.COMMAND_SEEK_BACK).setDisplayName("Back 20 seconds").build(),
      CommandButton.Builder(CommandButton.ICON_SKIP_FORWARD).setPlayerCommand(Player.COMMAND_SEEK_FORWARD).setDisplayName("Forward 20 seconds").build()))
    packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
      builder.setSessionActivity(PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
    }
    session = builder.build().also {
      // The app drives this player directly instead of through a MediaController, so Media3 would
      // never learn about the session. Registering it gives playback a media notification and a
      // foreground service; without that, Android freezes the app shortly after the screen turns off.
      addSession(it)
    }
    instance = this
    handler.post(ticker)
  }
  private val ticker = object : Runnable {
    override fun run() {
      if (sleepAt > 0 && System.currentTimeMillis() >= sleepAt) { sleepAt = 0; player.pause(); persist("Sleep timer") }
      if (player.isPlaying && SystemClock.elapsedRealtime() - lastSave >= 5000) persist()
      handler.postDelayed(this, 1000)
    }
  }
  private fun items(target: JSONObject): List<MediaItem> {
    val tracks = target.getJSONArray("tracks")
    return (0 until tracks.length()).map { i ->
      val track = tracks.getJSONObject(i)
      MediaItem.Builder().setMediaId(track.getString("id")).setUri(track.getString("uri"))
        .setMediaMetadata(MediaMetadata.Builder().setTitle(track.getString("title")).setArtist(target.getString("name")).setAlbumTitle(target.getString("name")).build()).build()
    }
  }
  /** Android's loudness enhancer raises the signal above the system's maximum volume and compresses peaks that would clip. */
  private fun applyBoost() {
    val audioSession = player.audioSessionId
    if (boost == 0 || audioSession == C.AUDIO_SESSION_ID_UNSET) { enhancer?.release(); enhancer = null; return }
    try {
      val effect = enhancer ?: LoudnessEnhancer(audioSession).also { enhancer = it }
      effect.setTargetGain(boost * 100)
      effect.setEnabled(true)
    } catch (failure: RuntimeException) {
      // A device without the effect keeps playing at system volume.
      enhancer?.release(); enhancer = null
    }
  }
  private fun point(index: Int = player.currentMediaItemIndex, position: Long = player.currentPosition): JSONObject? {
    val target = book ?: return null
    val track = target.getJSONArray("tracks").optJSONObject(index) ?: return null
    return JSONObject().put("bookId", target.getString("id")).put("bookName", target.getString("name"))
      .put("trackId", track.getString("id")).put("trackTitle", track.getString("title")).put("trackIndex", index)
      .put("position", position.coerceAtLeast(0)).put("duration", player.duration.takeIf { it > 0 } ?: track.optLong("duration"))
  }
  private fun persist(reason: String? = null) {
    if (changing || expectedPosition != null || error != null || player.playbackState == Player.STATE_IDLE) return
    point()?.let { store.save(it, reason); lastSave = SystemClock.elapsedRealtime() }
  }
  private fun load(target: JSONObject, trackId: String?, position: Long, play: Boolean) {
    val list = items(target)
    require(list.isNotEmpty()) { "There are no audio files in this folder." }
    val index = if (trackId == null) 0 else list.indexOfFirst { it.mediaId == trackId }
    require(index >= 0) { "The saved track is missing. Your position is still in History. Choose a track to continue." }
    changing = true
    try {
      book = target; error = null; pendingUndoId = null; expectedPosition = position.coerceAtLeast(0)
      player.setMediaItems(list, index, position.coerceAtLeast(0))
      player.prepare()
      player.playWhenReady = play
    } finally { changing = false }
  }
  private fun toggle() {
    if (player.mediaItemCount == 0 || error != null) {
      val saved = store.current()
      val target = store.book(saved.optString("bookId")) ?: return
      load(target, saved.optString("trackId").takeIf { it.isNotEmpty() }, saved.optLong("position"), true)
    } else if (player.playbackState == Player.STATE_ENDED) {
      player.seekTo(0); player.play()
    } else if (player.playWhenReady) player.pause() else player.play()
  }
  fun command(action: String, data: JSONObject) {
    try {
      when (action) {
        "open" -> {
          val id = data.getString("bookId")
          val target = store.book(id) ?: error("This folder is unavailable. Rescan or add it again.")
          val saved = store.progress(id)
          val explicitTrack = data.optString("trackId").takeIf { it.isNotEmpty() }
          val selected = explicitTrack ?: saved?.optString("trackId")
          if (book?.optString("id") == id && selected == player.currentMediaItem?.mediaId && error == null) {
            if (data.optBoolean("play", true)) player.play()
          } else {
            persist(if (book?.optString("id") == id) "Before changing tracks" else "Before switching books")
            val position = if (explicitTrack == null || explicitTrack == saved?.optString("trackId")) saved?.optLong("position") ?: 0 else 0
            load(target, selected, position, data.optBoolean("play", true))
          }
        }
        "toggle" -> toggle()
        "pause" -> player.pause()
        "seek", "skip" -> {
          if (player.mediaItemCount == 0) {
            val saved = store.current(); val target = store.book(saved.optString("bookId")) ?: return
            load(target, saved.optString("trackId"), saved.optLong("position"), false)
          }
          if (error != null) return
          val current = expectedPosition ?: player.currentPosition
          val wanted = (if (action == "seek") data.getLong("position") else current + data.getLong("delta")).coerceAtLeast(0)
          val clamped = minOf(wanted, player.duration.takeIf { it > 0 } ?: Long.MAX_VALUE)
          if (expectedPosition != null) {
            // Save the intended restore point, never an unprepared player's position.
            val before = store.current()
            if (before.has("trackId")) store.save(before, "Before jump")
            expectedPosition = clamped
          }
          player.seekTo(clamped)
        }
        "restore", "undo" -> {
          val saved = if (action == "undo") store.undoPoint() ?: return else data.getJSONObject("point")
          val target = store.book(saved.getString("bookId")) ?: error("This folder is unavailable. Add it again to restore this position.")
          if (action == "restore") persist("Before restoring history")
          load(target, saved.getString("trackId"), saved.getLong("position"), false)
          if (action == "undo") pendingUndoId = saved.getLong("historyId")
        }
        "bookmark" -> {
          if (player.mediaItemCount == 0) store.save(store.current(), "Bookmark")
          else persist("Bookmark")
        }
        "speed" -> { val speed = data.getDouble("speed").toFloat().coerceIn(0.5f, 2.5f); player.setPlaybackSpeed(speed); store.write("speed", speed.toString()) }
        "boost" -> { boost = data.getInt("boost").coerceIn(0, 12); store.write("boost", boost.toString()); applyBoost() }
        "sleep" -> { val minutes = data.getLong("minutes"); sleepAt = if (minutes > 0) System.currentTimeMillis() + minutes * 60000 else 0 }
      }
    } catch (failure: Exception) { error = failure.message ?: "Playback could not continue." }
  }
  fun status(): JSONObject {
    val current = if (expectedPosition == null && error == null) point() ?: store.current() else store.current()
    return JSONObject(current.toString()).put("playing", player.isPlaying).put("loading", expectedPosition != null && error == null)
      .put("position", expectedPosition ?: current.optLong("position")).put("speed", player.playbackParameters.speed.toDouble()).put("boost", boost)
      .put("sleepAt", sleepAt).put("error", error ?: JSONObject.NULL).put("canUndo", store.undoPoint() != null)
  }
  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val result = super.onStartCommand(intent, flags, startId)
    val commands = pendingCommands.toList(); pendingCommands.clear()
    commands.forEach { (action, data) -> command(action, data) }
    return result
  }
  override fun onDestroy() {
    persist()
    instance = null
    handler.removeCallbacksAndMessages(null)
    enhancer?.release(); session?.release(); player.release(); store.close()
    super.onDestroy()
  }
}
