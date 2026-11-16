package app.kube.music;

import android.app.PendingIntent;
import android.content.Intent;
import android.webkit.WebSettings;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

/** Owns playback independently of the Activity and WebView. */
public class PlaybackService extends MediaSessionService {
    private MediaSession mediaSession;
    @Override public void onCreate() {
        super.onCreate();
        DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
            .setBufferDurationsMs(10000, 300000, 10000, 2000)
            .setPrioritizeTimeOverSizeThresholds(true)
            .build();
        // Public media proxies can reject the default Media3 user-agent. Use the
        // device's real WebView identity for the same compatibility as the web app.
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
            .setUserAgent(WebSettings.getDefaultUserAgent(this) + " Kube/" + BuildConfig.VERSION_NAME);
        ExoPlayer player = new ExoPlayer.Builder(this).setLoadControl(loadControl)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(new DefaultDataSource.Factory(this, http)))
            .build();
        player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true);
        player.setHandleAudioBecomingNoisy(true);
        player.setWakeMode(C.WAKE_MODE_NETWORK);
        PendingIntent activity = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        mediaSession = new MediaSession.Builder(this, player).setSessionActivity(activity).build();
    }
    @Nullable @Override public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) { return mediaSession; }
    @Override public void onDestroy() {
        if (mediaSession != null) { mediaSession.getPlayer().release(); mediaSession.release(); mediaSession = null; }
        super.onDestroy();
    }
}
