package com.apcanario.groovebox;

/**
 * Spec 9.1: a screen under 600 dp on its short side is a phone and stays portrait; 600 dp or more is
 * a tablet and rotates freely (with the user's rotation lock). Pure Java so it is unit tested without
 * a device. The values are android.content.pm.ActivityInfo's SCREEN_ORIENTATION_PORTRAIT (1) and
 * SCREEN_ORIENTATION_FULL_USER (13), checked against ActivityInfo in the unit test.
 */
public final class OrientationRule {

    public static final int TABLET_MIN_DP = 600;
    public static final int PORTRAIT = 1;
    public static final int FULL_USER = 13;

    private OrientationRule() {}

    public static boolean isTablet(int smallestScreenWidthDp) {
        return smallestScreenWidthDp >= TABLET_MIN_DP;
    }

    public static int requestedOrientation(int smallestScreenWidthDp) {
        return isTablet(smallestScreenWidthDp) ? FULL_USER : PORTRAIT;
    }
}
