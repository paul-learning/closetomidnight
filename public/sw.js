// Service Worker: zeigt Push-Benachrichtigungen und öffnet beim Antippen die eigene Spielerseite.
self.addEventListener("push", event => {
  let msg = { title: "Der Weltuntergangs-Kurier", body: "", url: "/" };
  try { msg = { ...msg, ...event.data.json() }; } catch { /* leere oder kaputte Nachricht */ }
  event.waitUntil(self.registration.showNotification(msg.title, {
    body: msg.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: msg.url }, tag: "fvz",
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url === url);
    return open ? open.focus() : clients.openWindow(url);
  }));
});
