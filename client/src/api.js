const base = '';

async function req(path, options = {}) {
  const url = `${base}${path}`;
  const headers = { ...options.headers };
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    ...options,
    headers,
    body:
      options.body && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body,
  });
  if (!res.ok) {
    let err = res.statusText;
    try {
      const j = await res.json();
      err = j.error || err;
    } catch {
      /* ignore */
    }
    throw new Error(err);
  }
  const ct = res.headers.get('content-type');
  if (ct && ct.includes('application/json')) return res.json();
  return res;
}

export const api = {
  items: () => req('/api/items'),
  item: (id) => req(`/api/items/${id}`),
  createItem: (formData) =>
    req('/api/items', { method: 'POST', body: formData }),
  createDescribeOnly: (body) =>
    req('/api/items/describe-only', { method: 'POST', body }),
  updateItem: (id, formData) =>
    req(`/api/items/${id}`, { method: 'PUT', body: formData }),
  updateItemFields: (id, fields) => {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => {
      if (v !== undefined && v !== null) fd.append(k, String(v));
    });
    return req(`/api/items/${id}`, { method: 'PUT', body: fd });
  },
  deleteItem: (id) => req(`/api/items/${id}`, { method: 'DELETE' }),
  scanItem: (id) => req(`/api/items/${id}/scan`, { method: 'POST' }),
  recoverItem: (id) => req(`/api/items/${id}/recover`, { method: 'POST' }),
  exportPdf: (id) => {
    window.open(`${base}/api/items/${id}/export-pdf`, '_blank');
  },
  listings: (itemId) => req(`/api/listings/item/${itemId}`),
  updateListing: (id, body) => req(`/api/listings/${id}`, { method: 'PUT', body }),
  checkManual: (body) => req('/api/listings/check', { method: 'POST', body }),
  dmcaTemplate: (listingId) => req(`/api/listings/${listingId}/dmca`),
  settings: () => req('/api/settings'),
  saveSettings: (body) => req('/api/settings', { method: 'PUT', body }),
};
