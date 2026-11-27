package com.apcanario.groovebox;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class OrientationRuleTest {

    @Test
    public void phonesArePortraitOnly() {
        for (int sw : new int[] { 320, 360, 411, 412, 599 }) {
            assertFalse(OrientationRule.isTablet(sw));
            assertEquals(OrientationRule.PORTRAIT, OrientationRule.requestedOrientation(sw));
        }
    }

    @Test
    public void tabletsRotateFreely() {
        for (int sw : new int[] { 600, 601, 768, 800, 1024 }) {
            assertTrue(OrientationRule.isTablet(sw));
            assertEquals(OrientationRule.FULL_USER, OrientationRule.requestedOrientation(sw));
        }
    }

    @Test
    public void valuesMatchActivityInfoConstants() {
        // ActivityInfo.SCREEN_ORIENTATION_PORTRAIT and SCREEN_ORIENTATION_FULL_USER (API 18).
        assertEquals(1, OrientationRule.PORTRAIT);
        assertEquals(13, OrientationRule.FULL_USER);
    }
}
