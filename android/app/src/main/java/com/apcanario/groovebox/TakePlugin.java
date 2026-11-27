package com.apcanario.groovebox;

import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * G6 review E1: the take sheet's Save and Share in the APK. Capacitor's WebView has no download listener (an
 * <a download> of a blob does nothing) and no Web Share API, so src/ui/takeOut.ts hands the MP3 here instead:
 *
 * - write({ name, offset, data }): one base64 chunk of the file, appended to cacheDir/takes/<name> at byte
 *   `offset` (0 starts the file afresh and clears older takes). A chunk whose offset is not the file's length is
 *   refused, so a lost chunk fails loudly instead of saving a broken MP3. Chunks keep each bridge message small
 *   (a ten-minute take is about 11 MB).
 * - save({ name, bytes }): copies the staged file into Downloads through MediaStore (Android 10, API 29, and up;
 *   no permission). Below API 29 a public Downloads write needs WRITE_EXTERNAL_STORAGE, which the app does not ask
 *   for, so it resolves { saved: false, reason: "old-android" } and the sheet says to use Share.
 * - share({ name, bytes }): opens the share sheet (ACTION_SEND) with a FileProvider URI of the staged file
 *   (res/xml/file_paths.xml shares only cacheDir/takes/). Resolves { shared: true } once the sheet is open.
 *
 * The plugin runs on Capacitor's plugin thread, not the UI thread, so the file work does not block the screen.
 */
@CapacitorPlugin(name = "Take")
public class TakePlugin extends Plugin {

    static final String DIR = "takes";

    private File dir() {
        return new File(getContext().getCacheDir(), DIR);
    }

    /** The staged file for a name the app gave, or null if the name is not a plain MP3 file name. */
    private File staged(PluginCall call) {
        String name = TakeName.clean(call.getString("name", ""));
        if (name == null) {
            call.reject("bad take name", "BAD_NAME");
            return null;
        }
        return new File(dir(), name);
    }

    /** The staged file, checked to hold exactly `bytes` bytes (every chunk arrived). */
    private File complete(PluginCall call) {
        File f = staged(call);
        if (f == null) return null;
        Integer bytes = call.getInt("bytes");
        if (!f.isFile() || bytes == null || f.length() != bytes.longValue()) {
            call.reject("take not fully written", "INCOMPLETE");
            return null;
        }
        return f;
    }

    @PluginMethod
    public void write(PluginCall call) {
        File f = staged(call);
        if (f == null) return;
        Integer offset = call.getInt("offset");
        String data = call.getString("data");
        if (offset == null || data == null) {
            call.reject("offset and data needed", "BAD_CHUNK");
            return;
        }
        try {
            File d = dir();
            if (!d.isDirectory() && !d.mkdirs()) throw new IOException("cannot make " + d);
            if (offset == 0) {
                File[] old = d.listFiles();
                if (old != null) for (File o : old) if (!o.getName().equals(f.getName())) o.delete();
            } else if (!f.isFile() || f.length() != offset.longValue()) {
                call.reject("chunk out of order", "BAD_CHUNK");
                return;
            }
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            try (OutputStream out = new FileOutputStream(f, offset != 0)) {
                out.write(bytes);
            }
            JSObject ret = new JSObject();
            ret.put("bytes", f.length());
            call.resolve(ret);
        } catch (IOException | IllegalArgumentException e) {
            call.reject("write failed: " + e.getMessage(), "WRITE_FAILED", e);
        }
    }

    @PluginMethod
    public void save(PluginCall call) {
        File f = complete(call);
        if (f == null) return;
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            ret.put("saved", false);
            ret.put("reason", "old-android");
            call.resolve(ret);
            return;
        }
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues v = new ContentValues();
        v.put(MediaStore.Downloads.DISPLAY_NAME, f.getName());
        v.put(MediaStore.Downloads.MIME_TYPE, "audio/mpeg");
        v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
        v.put(MediaStore.Downloads.IS_PENDING, 1);
        Uri uri = null;
        try {
            uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) throw new IOException("MediaStore refused the file");
            try (InputStream in = new FileInputStream(f); OutputStream out = resolver.openOutputStream(uri)) {
                if (out == null) throw new IOException("MediaStore gave no stream");
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
            ContentValues done = new ContentValues();
            done.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(uri, done, null, null);
            ret.put("saved", true);
            call.resolve(ret);
        } catch (IOException | RuntimeException e) {
            if (uri != null) resolver.delete(uri, null, null);
            call.reject("save failed: " + e.getMessage(), "SAVE_FAILED", e);
        }
    }

    @PluginMethod
    public void share(PluginCall call) {
        File f = complete(call);
        if (f == null) return;
        try {
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("audio/mpeg");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_TITLE, f.getName());
            send.setClipData(ClipData.newRawUri(f.getName(), uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, f.getName());
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().runOnUiThread(() -> {
                try {
                    getActivity().startActivity(chooser);
                    JSObject ret = new JSObject();
                    ret.put("shared", true);
                    call.resolve(ret);
                } catch (RuntimeException e) {
                    call.reject("share failed: " + e.getMessage(), "SHARE_FAILED", e);
                }
            });
        } catch (RuntimeException e) {
            call.reject("share failed: " + e.getMessage(), "SHARE_FAILED", e);
        }
    }
}
