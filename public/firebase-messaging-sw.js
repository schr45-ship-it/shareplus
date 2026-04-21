/* eslint-disable no-undef */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload?.notification?.title ?? payload?.data?.title ?? "SharePlus";
  const body = payload?.notification?.body ?? payload?.data?.body ?? "";

  const requestId = payload?.data?.requestId ?? "";
  const deepLink = payload?.data?.deepLink ?? (requestId ? `/?requestId=${encodeURIComponent(requestId)}` : "/");
  const actionType = payload?.data?.type ?? "";

  if (
    actionType === "INTEREST_REQUEST_APPROVED" ||
    actionType === "INTEREST_REQUEST_REJECTED" ||
    actionType === "INTEREST_REQUEST_CREATED"
  ) {
    event.waitUntil(
      (async () => {
        const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of allClients) {
          client.postMessage({ type: "SHAREPLUS_NEW_MESSAGE" });
        }
      })()
    );
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: {
        deepLink,
        requestId,
        actionType,
      },
      actions: requestId
        ? [
            { action: "ACCEPT", title: "כן, פנוי" },
            { action: "DECLINE", title: "לא פנוי" },
            { action: "COUNTER", title: "הצע זמן אחר" },
          ]
        : undefined,
    })
  );
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
