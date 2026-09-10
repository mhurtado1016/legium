// Service worker mínimo para notificaciones push (sección 6.3, punto 4).
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'Legium', body: '' }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon.png',
    }),
  )
})
