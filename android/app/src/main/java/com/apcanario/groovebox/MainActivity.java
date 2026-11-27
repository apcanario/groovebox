package com.apcanario.groovebox;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * G6: the Groovebox APK. Phones are portrait only, tablets (600 dp or more on the short side) rotate
 * freely (spec 9.1); the web app picks its own layout from the window size (src/ui/size.ts).
 * KeepAwakePlugin keeps the screen on while playing (spec section 2). No service, no background audio.
 * Capacitor's Bridge already sets mediaPlaybackRequiresUserGesture(false); the app still starts its
 * AudioContext on the first tap.
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(KeepAwakePlugin.class);
        super.onCreate(savedInstanceState);
        applyOrientation();
    }

    private void applyOrientation() {
        int sw = getResources().getConfiguration().smallestScreenWidthDp;
        setRequestedOrientation(OrientationRule.requestedOrientation(sw));
    }
}
