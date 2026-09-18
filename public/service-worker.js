// Service Worker — تخزين مؤقت لهيكل التطبيق الأساسي (App Shell) للعمل الميداني بدون إنترنت
// النطاق: تخزين الصفحات الثابتة والأصول (CSS/JS) فقط. البيانات الحيّة (استعلامات DB) لا تُخزَّن هنا؛
// تسجيل المستفيدين أثناء انقطاع الاتصال يُدار عبر طابور IndexedDB في src/lib/offline/queue.ts

const CACHE_NAME = "erp-shell-v1";
const APP_SHELL = ["/", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // لا نتدخّل في طلبات POST/PATCH/DELETE (server actions، إرسال نماذج) — تمرّ كما هي
  if (request.method !== "GET") return;

  // Network-first للصفحات، مع الرجوع للتخزين المؤقت عند انقطاع الاتصال
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
  );
});
