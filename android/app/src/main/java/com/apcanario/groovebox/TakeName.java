package com.apcanario.groovebox;

/**
 * The file name a take is staged and saved under (TakePlugin). The app names takes "<song> YYYY-MM-DD HH-MM.mp3"
 * with the song name already made safe (src/engine/index.ts); this keeps any path out of a name anyway: no
 * separators, no leading dot, only letters, digits, space, dot, dash, underscore and parentheses, at most 120
 * characters, ending in .mp3. Pure Java so it is unit tested without a device.
 */
public final class TakeName {

    public static final int MAX = 120;

    private TakeName() {}

    /** The cleaned name, or null when nothing usable is left. */
    public static String clean(String raw) {
        if (raw == null) return null;
        String s = raw.replaceAll("[^A-Za-z0-9 ._()\\-]", "_").trim();
        while (s.startsWith(".")) s = s.substring(1);
        if (!s.toLowerCase().endsWith(".mp3")) return null;
        String stem = s.substring(0, s.length() - 4).trim();
        if (stem.isEmpty() || stem.replace(".", "").isEmpty()) return null;
        if (stem.length() > MAX - 4) stem = stem.substring(0, MAX - 4);
        return stem + ".mp3";
    }
}
