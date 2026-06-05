// service worker that receives push notifications when the app is closed
// version: 2 — force-update bumps this so old caches are evicted
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// take over immediately — don't wait for old SWs to close
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

firebase.initializeApp({
  apiKey: "AIzaSyAU0xEZuPCv0Nq3C309XO1lpzSmpccYHDE",
  authDomain: "atlas-ceu-tasks.firebaseapp.com",
  projectId: "atlas-ceu-tasks",
  storageBucket: "atlas-ceu-tasks.firebasestorage.app",
  messagingSenderId: "1066045029366",
  appId: "1:1066045029366:web:c33f3d5f4a1e755d8325d7",
});

const messaging = firebase.messaging();

// IMPORTANT: do NOT call showNotification here.
// When the message includes a `notification` payload, the FCM SDK auto-
// displays it. Adding our own showNotification would produce duplicates
// (the original "two notifications" bug).
messaging.onBackgroundMessage(() => {
  // intentional no-op
});

// when the user clicks the notification, open / focus the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/atlas-ceu-tasks/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) return w.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
