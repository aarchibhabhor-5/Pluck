// Pluck Cloud API Routing Engine
// Directs /api requests to live Render backend in cloud production while keeping localhost seamless.
(function () {
  const BACKEND_HOST = 'https://pluck-0y8b.onrender.com';
  window.PLUCK_BACKEND_URL = BACKEND_HOST;

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (!isLocal) {
    const origFetch = window.fetch;
    window.fetch = function (resource, init) {
      if (typeof resource === 'string' && resource.startsWith('/api/')) {
        resource = BACKEND_HOST + resource;
      } else if (resource && typeof resource.url === 'string' && resource.url.startsWith('/api/')) {
        try {
          resource = new Request(BACKEND_HOST + resource.url, resource);
        } catch (e) {
          resource = BACKEND_HOST + resource.url;
        }
      }
      return origFetch.call(this, resource, init);
    };
  }
})();
