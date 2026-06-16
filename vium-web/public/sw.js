/**
 * VIUM 스마트 충전 관리 시스템 - 고정밀 서비스 워커 (Service Worker)
 * 웹 푸시 알림 수신 및 수명 주기 관리
 */

// 1. 서비스 워커 설치 즉시 활성화
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing New Version...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activated and Claiming Clients.');
    event.waitUntil(clients.claim());
});

// 2. 푸시 알림 수신 엔진
self.addEventListener('push', function(event) {
    console.log('[Service Worker] Push Event Received at:', new Date().toISOString());
    
    let data = {
        title: '⚡ VIUM 알림',
        body: '새로운 소식이 도착했습니다.',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        url: '/',
        type: 'INFO',
        role: 'USER'
    };

    if (event.data) {
        try {
            const jsonPayload = event.data.json();
            data = { ...data, ...jsonPayload };
            console.log('[Service Worker] JSON Payload Parsed:', JSON.stringify(data));
        } catch (e) {
            data.body = event.data.text();
            console.warn('[Service Worker] Payload is not JSON:', data.body);
        }
    }

    // [핵심 추가]: 활성화된 React 창(Window)으로 알림 데이터 전송 (인앱 스토어 동기화)
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            console.log('[Service Worker] Broadcasting to', clientList.length, 'clients.');
            clientList.forEach(function(client) {
                client.postMessage({
                    type: 'PUSH_RECEIVED',
                    payload: data
                });
            });
        })
    );

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        vibrate: [300, 100, 300],
        data: {
            url: data.url
        },
        actions: [
            { action: 'open', title: '확인하기' },
            { action: 'close', title: '닫기' }
        ],
        tag: data.tag || 'vium-push-notification', 
        renotify: true,
        requireInteraction: true 
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
            .then(() => console.log('✅ [Service Worker] Notification Shown.'))
            .catch(err => console.error('❌ [Service Worker] Notification Error:', err))
    );
});

// 3. 알림 클릭 시 페이지 이동 로직
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    if (event.action === 'close') return;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            const targetUrl = event.notification.data.url || '/';
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(targetUrl);
        })
    );
});
