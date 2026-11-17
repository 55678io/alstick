// OneSignal setup (App ID from OneSignal dashboard > Settings > Keys & IDs)
const ONESIGNAL_APP_ID = "9c38b140-8a6f-4609-ae8a-8ca6b65d0762";
const SAFARI_WEB_ID = "web.onesignal.auto.64337d6b-67cd-4296-b41c-d41bc6b4a874";

// On GitHub Pages the site lives under /alstick/, so the service worker path and scope are set to match
const BASE = location.pathname.startsWith("/alstick") ? "/alstick/" : "/";

window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function (OneSignal) {
  if (ONESIGNAL_APP_ID.startsWith("YOUR-")) {
    console.warn("OneSignal App ID is not set (onesignal.js)");
    return;
  }
  try {
    await OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      safari_web_id: SAFARI_WEB_ID,
      serviceWorkerPath: BASE.slice(1) + "OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: BASE },
      allowLocalhostAsSecureOrigin: true,
    });
    window.__osReady = true;
  } catch (e) {
    window.__osError = (e && e.message) ? e.message : String(e);
    console.error("OneSignal init error:", e);
  }
});
