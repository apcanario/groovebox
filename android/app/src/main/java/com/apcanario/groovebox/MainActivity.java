package com.apcanario.groovebox;

import android.content.res.Configuration;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * G6: the Groovebox APK. Phones are portrait only, tablets (600 dp or more on the short side) rotate
 * freely (spec 9.1); the web app picks its own layout from the window size (src/ui/size.ts).
 * KeepAwakePlugin keeps the screen on while playing (spec section 2); TakePlugin saves and shares a take's MP3
 * (G6 review E1). No service, no background audio.
 * Capacitor's Bridge already sets mediaPlaybackRequiresUserGesture(false); the app still starts its
 * AudioContext on the first tap.
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(KeepAwakePlugin.class);
        registerPlugin(TakePlugin.class);
        super.onCreate(savedInstanceState);
        applyOrientation(getResources().getConfiguration());
    }

    /**
     * G6 review S1: the manifest's configChanges keep the activity (and the audio) alive through rotation, folding
     * and size changes, so the phone/tablet rule is read again here: a foldable opened to its inner screen rotates,
     * folded back it is portrait again.
     */
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyOrientation(newConfig);
    }

    private void applyOrientation(Configuration c) {
        int want = OrientationRule.requestedOrientation(c.smallestScreenWidthDp);
        if (getRequestedOrientation() != want) setRequestedOrientation(want);
    }
}
