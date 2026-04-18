/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDGdqwlq_oS_jlupgGnQdlacmcNB8puteI",
  authDomain: "shareplus1.firebaseapp.com",
  projectId: "shareplus1",
  storageBucket: "shareplus1.firebasestorage.app",
  messagingSenderId: "222377089673",
  appId: "1:222377089673:web:7f7902e202bae6acc88458",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title ?? payload?.data?.title ?? "SharePlus";
  const body = payload?.notification?.body ?? payload?.data?.body ?? "";

  const requestId = payload?.data?.requestId ?? "";
  const deepLink = payload?.data?.deepLink ?? (requestId ? `/?requestId=${encodeURIComponent(requestId)}` : "/");

  self.registration.showNotification(title, {
    body,
    data: {
      deepLink,
      requestId,
      actionType: payload?.data?.type ?? "",
    },
    actions: requestId
      ? [
          { action: "ACCEPT", title: "כן, פנוי" },
          { action: "DECLINE", title: "לא פנוי" },
          { action: "COUNTER", title: "הצע זמן אחר" },
        ]
      : undefined,
  });
});

self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const data = notification?.data ?? {};
  const deepLink = data.deepLink || "/";

  notification.close();

  event.waitUntil(
    (async () => {
      if (event.action) {
        const url = new URL(deepLink, self.location.origin);
        url.searchParams.set("notifAction", event.action);
        if (data.requestId) url.searchParams.set("requestId", data.requestId);

        const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of allClients) {
          if ("focus" in client) {
            client.navigate(url.toString());
            return client.focus();
          }
        }
        return clients.openWindow(url.toString());
      }

      const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) {
          client.navigate(deepLink);
          return client.focus();
        }
      }
      return clients.openWindow(deepLink);
    })()
  );
});
