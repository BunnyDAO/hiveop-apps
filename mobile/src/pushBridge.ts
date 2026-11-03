/**
 * The `push` and `open-settings` members of window.hiveopApp (ph-10), as page JavaScript that
 * shellBridge.ts embeds in the injected script. They call the Capacitor push plugin and the
 * shell's own HiveOpShell plugin through window.Capacitor (present on the site origin).
 *
 *   push: { state(), request(), token(), onToken(cb) }   capability `push`
 *   openSettings()                                       capability `open-settings`
 *
 * `push` is dropped at runtime when the Android build has no Firebase config
 * (window.__hiveopNoPush, set natively): push is then simply unavailable.
 */
export const PUSH_BRIDGE_JS = `
  function pushMembers(win, caps, platform) {
    var out = {};
    var native = function (plugin, method) {
      var c = win.Capacitor;
      if (!c || typeof c.nativePromise !== "function") return Promise.reject(new Error("shell unavailable"));
      return c.nativePromise(plugin, method, {});
    };
    if (caps.indexOf("open-settings") !== -1) {
      out.openSettings = function () { return native("HiveOpShell", "openSettings").then(function () {}); };
    }
    if (caps.indexOf("push") === -1) return out;

    var last = null, subs = [], waiters = [], listening = false;
    var shape = function (v) { return typeof v === "string" && v ? { platform: platform, token: v } : null; };
    var listen = function () {
      var c = win.Capacitor;
      if (listening || !c || typeof c.addListener !== "function") return;
      listening = true;
      c.addListener("PushNotifications", "registration", function (e) {
        var t = shape(e && e.value);
        if (!t) return;
        last = t;
        waiters.splice(0).forEach(function (w) { w(t); });
        subs.slice().forEach(function (cb) { try { cb({ platform: t.platform, token: t.token }); } catch (_) {} });
      });
      c.addListener("PushNotifications", "registrationError", function () {
        waiters.splice(0).forEach(function (w) { w(null); });
      });
    };
    var perm = function (method) {
      return native("PushNotifications", method).then(function (r) {
        var v = r && r.receive;
        return v === "granted" || v === "denied" ? v : "unknown";
      });
    };
    out.push = Object.freeze({
      state: function () { return perm("checkPermissions"); },
      request: function () {
        return perm("requestPermissions").then(function (v) {
          if (v !== "granted") return "denied";
          listen();
          return native("PushNotifications", "register").then(function () { return "granted"; });
        });
      },
      token: function () {
        return perm("checkPermissions").then(function (v) {
          if (v !== "granted") return null;
          listen();
          return new Promise(function (resolve, reject) {
            var done = false;
            var finish = function (t) { if (!done) { done = true; win.clearTimeout(timer); resolve(t ? { platform: t.platform, token: t.token } : null); } };
            var timer = win.setTimeout(function () { finish(null); }, 10000);
            waiters.push(finish);
            native("PushNotifications", "register").catch(function () { finish(null); });
          });
        });
      },
      onToken: function (cb) {
        if (typeof cb !== "function") return function () {};
        listen();
        subs.push(cb);
        return function () { var i = subs.indexOf(cb); if (i !== -1) subs.splice(i, 1); };
      }
    });
    return out;
  }`;
