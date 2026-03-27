import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export function AddItem() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('photo');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Photo mode
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [value, setValue] = useState('');
  const [serial, setSerial] = useState('');
  const [city, setCity] = useState('');
  const [radius, setRadius] = useState('25');
  const [frequency, setFrequency] = useState('daily');
  const [files, setFiles] = useState([]);

  // Description-only
  const [dName, setDName] = useState('');
  const [itemType, setItemType] = useState('');
  const [material, setMaterial] = useState('');
  const [color, setColor] = useState('');
  const [era, setEra] = useState('');
  const [marks, setMarks] = useState('');
  const [initials, setInitials] = useState('');
  const [unique, setUnique] = useState('');
  const [dDesc, setDDesc] = useState('');
  const [dCity, setDCity] = useState('');
  const [dRadius, setDRadius] = useState('25');
  const [dFreq, setDFreq] = useState('daily');

  async function submitPhoto(e) {
    e.preventDefault();
    if (!files.length) {
      setError('Please add at least one photo (up to three).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('name', name);
      if (category) fd.append('category', category);
      const fullDesc = [description, brand && `Brand: ${brand}`, value && `Approx. value: ${value}`, serial && `Serial: ${serial}`]
        .filter(Boolean)
        .join('\n');
      fd.append('description', fullDesc);
      fd.append('city', city);
      fd.append('search_radius', radius);
      fd.append('scan_frequency', frequency);
      files.slice(0, 3).forEach((f) => fd.append('photos', f));

      const item = await api.createItem(fd);
      navigate(`/items/${item.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitDescribe(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const item = await api.createDescribeOnly({
        name: dName,
        category: 'heirloom',
        description: dDesc,
        item_type: itemType,
        material,
        color,
        era,
        distinguishing_marks: marks,
        engravings_initials: initials,
        unique_features: unique,
        city: dCity,
        search_radius: parseInt(dRadius, 10) || 25,
        scan_frequency: dFreq,
      });
      navigate(`/items/${item.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-navy-900 placeholder-slate-400 focus:border-amber-brand focus:outline-none focus:ring-1 focus:ring-amber-brand';

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-white">Add a stolen item</h1>
      <p className="mt-2 text-slate-400">
        Choose how you want to register the item. Photos help visual matching; rich descriptions
        work for unique pieces without pictures.
      </p>

      <div className="mt-6 flex gap-2 rounded-lg bg-navy-850 p-1">
        <button
          type="button"
          onClick={() => setMode('photo')}
          className={`flex-1 rounded-md py-2 text-sm font-medium ${
            mode === 'photo' ? 'bg-amber-brand text-navy-950' : 'text-slate-400 hover:text-white'
          }`}
        >
          Photo upload
        </button>
        <button
          type="button"
          onClick={() => setMode('describe')}
          className={`flex-1 rounded-md py-2 text-sm font-medium ${
            mode === 'describe' ? 'bg-amber-brand text-navy-950' : 'text-slate-400 hover:text-white'
          }`}
        >
          Description only
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {mode === 'photo' ? (
        <form onSubmit={submitPhoto} className="mt-8 space-y-4 rounded-2xl border border-slate-800 bg-white p-6 shadow-xl">
          <label className="block text-sm font-medium text-navy-900">
            Photos (1–3)
            <input
              type="file"
              accept="image/*"
              multiple
              className={inputClass}
              onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 3))}
            />
          </label>
          <label className="block text-sm font-medium text-navy-900">
            Short name / title *
            <input required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-navy-900">
            Category
            <input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-navy-900">
            Description
            <textarea className={`${inputClass} min-h-[88px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm font-medium text-navy-900">
              Brand
              <input className={inputClass} value={brand} onChange={(e) => setBrand(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-navy-900">
              Approx. value
              <input className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-navy-900">
              Serial #
              <input className={inputClass} value={serial} onChange={(e) => setSerial(e.target.value)} />
            </label>
          </div>
          <label className="block text-sm font-medium text-navy-900">
            Craigslist / scan city (subdomain, e.g. <code className="text-amber-700">sfbay</code>,{' '}
            <code className="text-amber-700">newyork</code>) *
            <input
              required
              className={inputClass}
              placeholder="sfbay"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-navy-900">
              Search radius (miles)
              <input type="number" className={inputClass} value={radius} onChange={(e) => setRadius(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-navy-900">
              Scan frequency
              <select className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                <option value="6h">Every 6 hours</option>
                <option value="12h">Every 12 hours</option>
                <option value="daily">Daily</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-amber-brand py-3 font-semibold text-navy-950 hover:bg-amber-400 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Register item'}
          </button>
        </form>
      ) : (
        <form onSubmit={submitDescribe} className="mt-8 space-y-4 rounded-2xl border border-slate-800 bg-white p-6 shadow-xl">
          <label className="block text-sm font-medium text-navy-900">
            Label / name *
            <input required className={inputClass} value={dName} onChange={(e) => setDName(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-navy-900">
            Item type
            <input className={inputClass} value={itemType} onChange={(e) => setItemType(e.target.value)} placeholder="e.g. pocket watch, ring" />
          </label>
          <label className="block text-sm font-medium text-navy-900">
            Material
            <input className={inputClass} value={material} onChange={(e) => setMaterial(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-navy-900">
            Color
            <input className={inputClass} value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-navy-900">
            Approximate era / age
            <input className={inputClass} value={era} onChange={(e) => setEra(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-navy-900">
            Distinguishing marks
            <textarea className={`${inputClass} min-h-[72px]`} value={marks} onChange={(e) => setMarks(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-navy-900">
            Engravings / initials
            <input className={inputClass} value={initials} onChange={(e) => setInitials(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-navy-900">
            Unique features
            <textarea className={`${inputClass} min-h-[72px]`} value={unique} onChange={(e) => setUnique(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-navy-900">
            Full narrative
            <textarea
              required
              className={`${inputClass} min-h-[100px]`}
              value={dDesc}
              onChange={(e) => setDDesc(e.target.value)}
              placeholder="Tell the story — context helps generate better search keywords."
            />
          </label>
          <label className="block text-sm font-medium text-navy-900">
            Craigslist city subdomain *
            <input
              required
              className={inputClass}
              placeholder="sfbay"
              value={dCity}
              onChange={(e) => setDCity(e.target.value)}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-navy-900">
              Search radius (miles)
              <input type="number" className={inputClass} value={dRadius} onChange={(e) => setDRadius(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-navy-900">
              Scan frequency
              <select className={inputClass} value={dFreq} onChange={(e) => setDFreq(e.target.value)}>
                <option value="6h">Every 6 hours</option>
                <option value="12h">Every 12 hours</option>
                <option value="daily">Daily</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-amber-brand py-3 font-semibold text-navy-950 hover:bg-amber-400 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Create search profile'}
          </button>
        </form>
      )}
    </div>
  );
}
