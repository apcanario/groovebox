package com.apcanario.groovebox;

import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Keeps the screen on while the jam plays (spec section 2), driven from src/platform/keepAwake.ts:
 * Capacitor.nativePromise("KeepAwake", "set", { on }). FLAG_KEEP_SCREEN_ON needs no permission and
 * lasts only while the activity is visible, so nothing plays on with the screen off by this path.
 */
@CapacitorPlugin(name = "KeepAwake")
public class KeepAwakePlugin extends Plugin {

    @PluginMethod
    public void set(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity()
            .runOnUiThread(() -> {
                if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                JSObject ret = new JSObject();
                ret.put("on", on);
                call.resolve(ret);
            });
    }
}
