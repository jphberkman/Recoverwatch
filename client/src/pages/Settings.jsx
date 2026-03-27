import { useEffect, useState } from 'react';
import { api } from '../api';

export function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api
      .settings()
      .then(setSettings)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  function field(key, label, type = 'text', placeholder = '') {
    return (
      <label className="block text-sm font-medium text-navy-900">
        {label}
        <input
          type={type}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-navy-900 focus:border-amber-brand focus:outline-none focus:ring-1 focus:ring-amber-brand"
          value={settings[key] ?? ''}
          placeholder={placeholder}
          onChange={(e) => {
            setSettings((s) => ({ ...s, [key]: e.target.value }));
            setSaved(false);
          }}
        />
      </label>
    );
  }

  async function save(e) {
    e.preventDefault();
    setErr(null);
    try {
      await api.saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setErr(e.message);
    }
  }

  if (loading) return <p className="text-slate-400">Loading settings…</p>;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold text-white">Settings</h1>
      <p className="mt-2 text-slate-400">
        Notification email and SMTP are optional for this MVP — without SMTP, alerts are logged on
        the server console. eBay credentials belong in your <code className="text-amber-400">.env</code>{' '}
        file (not stored in the database).
      </p>

      {err && (
        <div className="mt-4 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{err}</div>
      )}

      <form onSubmit={save} className="mt-8 space-y-4 rounded-2xl border border-slate-800 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-navy-900">Default city targets</h2>
        <p className="text-sm text-slate-600">
          Comma-separated Craigslist subdomains you often use (reference only — each item has its
          own city).
        </p>
        {field('default_cities', 'City subdomains', 'text', 'sfbay, newyork, losangeles')}

        <h2 className="pt-4 text-lg font-semibold text-navy-900">Notifications</h2>
        {field('notification_email', 'Alert email', 'email')}

        <h3 className="text-sm font-semibold text-navy-800">SMTP (optional)</h3>
        {field('smtp_host', 'Host')}
        {field('smtp_port', 'Port', 'number')}
        {field('smtp_user', 'Username')}
        {field('smtp_pass', 'Password', 'password')}
        {field('smtp_from', 'From address', 'text', 'alerts@yourdomain.com')}
        <label className="flex items-center gap-2 text-sm text-navy-900">
          <input
            type="checkbox"
            checked={settings.smtp_secure === 'true'}
            onChange={(e) =>
              setSettings((s) => ({ ...s, smtp_secure: e.target.checked ? 'true' : 'false' }))
            }
          />
          Use TLS (secure)
        </label>

        <button
          type="submit"
          className="w-full rounded-lg bg-amber-brand py-3 font-semibold text-navy-950 hover:bg-amber-400"
        >
          Save settings
        </button>
        {saved && <p className="text-center text-sm text-emerald-700">Saved.</p>}
      </form>
    </div>
  );
}
