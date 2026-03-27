import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { MatchBadge } from '../components/MatchBadge';

function imgSrc(p) {
  if (!p) return null;
  if (p.startsWith('http')) return p;
  return p.startsWith('/') ? p : `/${p}`;
}

function parseAnalysis(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return { explanation: String(raw) };
  }
}

export function ItemDetail() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [scanMsg, setScanMsg] = useState(null);
  const [fbNote] = useState(true);

  const [pasteUrl, setPasteUrl] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteDesc, setPasteDesc] = useState('');
  const [pasteBusy, setPasteBusy] = useState(false);

  function load() {
    return Promise.all([api.item(id), api.listings(id)]).then(([it, ls]) => {
      setItem(it);
      setListings(ls);
    });
  }

  useEffect(() => {
    load()
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function runScan() {
    setScanMsg(null);
    try {
      await api.scanItem(id);
      setScanMsg('Scan started in the background. Refresh in a few minutes for results.');
    } catch (e) {
      setScanMsg(e.message);
    }
  }

  async function toggleActive() {
    try {
      await api.updateItemFields(id, { active: item.active ? 0 : 1 });
      const it = await api.item(id);
      setItem(it);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function markRecovered() {
    if (!window.confirm('Mark this item as recovered? Scanning will stop.')) return;
    try {
      await api.recoverItem(id);
      const it = await api.item(id);
      setItem(it);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function exportPdf() {
    api.exportPdf(id);
  }

  async function pasteCheck(e) {
    e.preventDefault();
    if (!pasteUrl.trim()) return;
    setPasteBusy(true);
    try {
      await api.checkManual({
        item_id: parseInt(id, 10),
        url: pasteUrl.trim(),
        title: pasteTitle || 'Pasted listing',
        description: pasteDesc,
        images: [],
      });
      setPasteUrl('');
      setPasteTitle('');
      setPasteDesc('');
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setPasteBusy(false);
    }
  }

  async function openDmca(listingId) {
    const { template } = await api.dmcaTemplate(listingId);
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<pre style="font-family:system-ui;padding:1rem;white-space:pre-wrap">${template.replace(/</g, '&lt;')}</pre>`);
    }
  }

  async function setListingStatus(listingId, status) {
    await api.updateListing(listingId, { status });
    const ls = await api.listings(id);
    setListings(ls);
  }

  if (loading) return <p className="text-slate-400">Loading…</p>;
  if (err || !item) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-red-200">
        {err || 'Not found'} — <Link to="/" className="text-amber-brand underline">Back</Link>
      </div>
    );
  }

  const sorted = [...listings].sort((a, b) => {
    const order = { high: 0, possible: 1, unlikely: 2 };
    const ao = order[(a.match_score || 'unlikely').toLowerCase()] ?? 3;
    const bo = order[(b.match_score || 'unlikely').toLowerCase()] ?? 3;
    if (ao !== bo) return ao - bo;
    return new Date(b.flagged_at) - new Date(a.flagged_at);
  });

  return (
    <div>
      <Link to="/" className="text-sm text-amber-brand hover:underline">
        ← All items
      </Link>

      <div className="mt-4 flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 rounded-2xl border border-slate-800 bg-white p-6 text-navy-900 shadow-xl">
          <div className="flex flex-wrap gap-4">
            {item.photos && item.photos[0] ? (
              <img
                src={imgSrc(item.photos[0])}
                alt=""
                className="h-40 w-40 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-lg bg-slate-200 text-sm text-slate-500">
                No photo
              </div>
            )}
            <div>
              <h1 className="text-2xl font-semibold">{item.name}</h1>
              <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{item.description}</p>
              <dl className="mt-4 grid gap-1 text-sm text-slate-700">
                <div>
                  <dt className="inline font-medium">City / CL subdomain: </dt>
                  <dd className="inline">{item.city || '—'}</dd>
                </div>
                <div>
                  <dt className="inline font-medium">Scan: </dt>
                  <dd className="inline">
                    {item.scan_frequency} · {item.search_radius} mi
                  </dd>
                </div>
                <div>
                  <dt className="inline font-medium">Status: </dt>
                  <dd className="inline">{item.status}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleActive}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy-900 hover:bg-slate-50"
            >
              {item.active ? 'Pause scanning' : 'Resume scanning'}
            </button>
            <button
              type="button"
              onClick={runScan}
              disabled={!item.active}
              className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:opacity-50"
            >
              Run scan now
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-navy-900 hover:bg-slate-50"
            >
              Export case PDF
            </button>
            <button
              type="button"
              onClick={markRecovered}
              className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
            >
              Mark as recovered
            </button>
          </div>
          {scanMsg && <p className="mt-3 text-sm text-amber-800">{scanMsg}</p>}

          <div className="mt-8 border-t border-slate-200 pt-6">
            <h2 className="text-lg font-semibold">Facebook Marketplace</h2>
            <p className="mt-2 text-sm text-slate-600">
              Facebook blocks automated access. Search manually, then paste a listing URL and any
              title or description you can copy — we&apos;ll run the same AI analysis and save a
              snapshot when possible.
            </p>
            {fbNote && (
              <form onSubmit={pasteCheck} className="mt-4 space-y-3">
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Listing URL"
                  value={pasteUrl}
                  onChange={(e) => setPasteUrl(e.target.value)}
                />
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Title (optional)"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                />
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Description (optional)"
                  rows={3}
                  value={pasteDesc}
                  onChange={(e) => setPasteDesc(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={pasteBusy}
                  className="rounded-lg bg-amber-brand px-4 py-2 text-sm font-semibold text-navy-950 hover:bg-amber-400 disabled:opacity-60"
                >
                  {pasteBusy ? 'Analyzing…' : 'Paste a listing'}
                </button>
              </form>
            )}
          </div>
        </div>

        <aside className="w-full shrink-0 lg:w-72">
          <div className="rounded-xl border border-slate-800 bg-navy-850 p-4 text-sm text-slate-300">
            <p className="font-medium text-white">Activity</p>
            <p className="mt-2">
              Scans: {item.stats?.scan_count ?? 0}
              <br />
              Potential matches: {item.stats?.match_count ?? 0}
              <br />
              Last scan:{' '}
              {item.stats?.last_scanned
                ? new Date(item.stats.last_scanned).toLocaleString()
                : '—'}
            </p>
          </div>
        </aside>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-white">Flagged listings</h2>
        <p className="mt-1 text-sm text-slate-400">Sorted by match confidence, then recency.</p>

        {sorted.length === 0 ? (
          <p className="mt-6 rounded-xl border border-slate-800 bg-navy-850 p-8 text-center text-slate-400">
            No listings yet. Run a scan or paste a Facebook listing above.
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {sorted.map((L) => {
              const a = parseAnalysis(L.ai_analysis);
              return (
                <li
                  key={L.id}
                  className="overflow-hidden rounded-xl border border-slate-800 bg-white shadow"
                >
                  <div className="flex flex-col gap-4 p-4 sm:flex-row">
                    <div className="h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-200">
                      {L.images && L.images[0] ? (
                        <img src={imgSrc(L.images[0])} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-500">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium uppercase text-navy-900">
                          {L.platform}
                        </span>
                        <MatchBadge score={L.match_score} />
                        <span className="text-xs text-slate-500">{L.flagged_at}</span>
                      </div>
                      <h3 className="mt-2 font-semibold text-navy-900">{L.title || 'Untitled'}</h3>
                      <p className="text-sm text-slate-600">
                        {L.price} · {L.location || 'Location unknown'}
                      </p>
                      <a
                        href={L.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-sm text-amber-700 hover:underline break-all"
                      >
                        {L.url}
                      </a>
                      {a?.explanation && (
                        <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{a.explanation}</p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openDmca(L.id)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-navy-900 hover:bg-slate-50"
                        >
                          Report to platform
                        </button>
                        <button
                          type="button"
                          onClick={() => setListingStatus(L.id, 'reviewed')}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Mark reviewed
                        </button>
                        <button
                          type="button"
                          onClick={() => setListingStatus(L.id, 'dismissed')}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
