/**
 * 遗留 runtime cache 清理脚本(由 workbox generateSW 的 importScripts 注入)。
 *
 * 背景:generateSW 的 cleanupOutdatedCaches 只清理 precache,
 * 历史版本遗留的 runtime cache(如已废弃的 bing-wallpapers-json)
 * 永远不会被自动删除。此脚本在 SW activate 时按白名单清理
 * bing-* 前缀的旧缓存,现役缓存由各自的 ExpirationPlugin 管理。
 */
/* global self, caches */
(function () {
  'use strict';

  var RUNTIME_CACHE_WHITELIST = [
    'bing-wallpapers-data',
    'bing-thumbs-cache',
    'bing-images-cache',
  ];

  self.addEventListener('activate', function (event) {
    event.waitUntil(
      caches.keys().then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key.indexOf('bing-') === 0 && RUNTIME_CACHE_WHITELIST.indexOf(key) === -1;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
    );
  });
})();
