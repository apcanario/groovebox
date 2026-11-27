package com.apcanario.groovebox;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class TakeNameTest {

    @Test
    public void keepsTheAppsOwnNames() {
        assertEquals("Night drive 2026-11-27 21-05.mp3", TakeName.clean("Night drive 2026-11-27 21-05.mp3"));
        assertEquals("take-1764277500000.mp3", TakeName.clean("take-1764277500000.mp3"));
    }

    @Test
    public void keepsPathsOut() {
        assertEquals("_.._etc_passwd.mp3", TakeName.clean("/../etc/passwd.mp3"));
        assertEquals("a_b.mp3", TakeName.clean("a/b.mp3"));
        assertEquals("hidden.mp3", TakeName.clean("..hidden.mp3"));
    }

    @Test
    public void refusesWhatIsNotAnMp3Name() {
        assertNull(TakeName.clean(null));
        assertNull(TakeName.clean(""));
        assertNull(TakeName.clean("take.wav"));
        assertNull(TakeName.clean(".mp3"));
        assertNull(TakeName.clean("...mp3"));
    }

    @Test
    public void capsTheLength() {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < 300; i++) b.append('x');
        String n = TakeName.clean(b + ".mp3");
        assertEquals(TakeName.MAX, n.length());
        assertEquals(true, n.endsWith(".mp3"));
    }
}
