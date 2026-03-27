import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

function thumbUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

export function Dashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api
      .items()
      .then(setItems)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <p className="text-center text-slate-400" role="status">
        Loading your items…
      </p>
    );
  }

  if (err) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-red-200">
        {err} — is the API running on port 3001?
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-white p-10 text-center shadow-xl">
        <h1 className="text-balance text-xl font-semibold text-navy-900">
          We&apos;re watching. Add your first item to begin monitoring.
        </h1>
        <p className="mt-3 text-slate-600">
          Register what was taken — with photos or a detailed description — and we&apos;ll scan
          marketplaces on a schedule you choose. You stay in control of every potential match.
        </p>
        <Link
          to="/add"
          className="mt-8 inline-block rounded-lg bg-amber-brand px-6 py-3 font-semibold text-navy-950 hover:bg-amber-400"
        >
          Add an item
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-white">Your registered items</h1>
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => {
          const st = item.stats || {};
          const photo = item.photos && item.photos[0];
          return (
            <li key={item.id}>
              <Link
                to={`/items/${item.id}`}
                className="flex gap-4 rounded-xl border border-slate-800 bg-white p-4 text-left shadow-md transition hover:border-amber-brand/40 hover:shadow-lg"
              >
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-200">
                  {photo ? (
                    <img
                      src={thumbUrl(photo)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                      No photo
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-navy-900">{item.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {st.scan_count ?? 0} scans · {st.match_count ?? 0} potential matches
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Last scanned:{' '}
                    {st.last_scanned
                      ? new Date(st.last_scanned).toLocaleString()
                      : 'Not yet'}
                  </p>
                  {item.active === 0 && (
                    <span className="mt-2 inline-block rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                      Inactive
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
