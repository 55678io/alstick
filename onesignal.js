// OneSignal setup — apna App ID yahan daalein (OneSignal dashboard > Settings > Keys & IDs)
const ONESIGNAL_APP_ID = "YOUR-ONESIGNAL-APP-ID";

// GitHub Pages par site /alstick/ ke andar chalti hai, isliye worker ka path/scope set hai
const BASE = location.pathname.startsWith("/alstick") ? "/alstick/" : "/";

window.OneSignalDeferred = window.OneSignalDeferred || [];
OneSignalDeferred.push(async function (OneSignal) {
  if (ONESIGNAL_APP_ID.startsWith("YOUR-")) {
    console.warn("OneSignal App ID abhi set nahi hai (onesignal.js)");
    return;
  }
  await OneSignal.init({
    appId: ONESIGNAL_APP_ID,
    serviceWorkerPath: BASE.slice(1) + "OneSignalSDKWorker.js",
    serviceWorkerParam: { scope: BASE },
    allowLocalhostAsSecureOrigin: true,
  });
});
