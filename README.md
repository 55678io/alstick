# Alstick

A minimal white web app: animated "Alstick" logo splash → 6-digit PIN login → 3-second loading screen → home page, with OneSignal web push notifications.

Live site: https://55678io.github.io/alstick/

## OneSignal
- The App ID is set in `onesignal.js` (OneSignal app: Alstick, Site URL `https://55678io.github.io`).
- Send notifications from the OneSignal dashboard: **Messages → New Push**.
- On iPhone, add the site to the Home Screen and open it from there to enable notifications (iOS 16.4+).

Note: the PIN is checked in client-side code, so it is not real security.
