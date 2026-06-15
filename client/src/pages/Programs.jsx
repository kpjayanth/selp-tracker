import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPrograms, createProgram } from '../api';
import toast from 'react-hot-toast';
import { PlusIcon, CalendarIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';

const STATUS_COLORS = {
  PLANNED: 'badge bg-yellow-100 text-yellow-800',
  ACTIVE: 'badge bg-green-100 text-green-800',
  COMPLETED: 'badge bg-gray-100 text-gray-700',
};

export default function Programs() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', startDate: '', endDate: '', status: 'PLANNED' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPrograms().then((r) => setPrograms(r.data)).catch(() => toast.error('Failed to load programs')).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await createProgram(form);
      setPrograms([data, ...programs]);
      setShowCreate(false);
      setForm({ name: '', location: '', startDate: '', endDate: '', status: 'PLANNED' });
      toast.success('Program created');
    } catch {
      toast.error('Failed to create program');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Programs</h1>
          <p className="text-sm text-gray-500 mt-0.5">SELP cohorts you have access to</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <PlusIcon className="w-4 h-4" /> New Program
        </button>
      </div>

      {showCreate && (
        <div className="card p-5 mb-6">
          <h2 className="font-semibold mb-4">Create Program</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Program Name *</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="PLANNED">Planned</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="label">End Date</label>
              <input type="date" className="input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create'}</button>
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : programs.length === 0 ? (
        <div className="text-center py-16 card">
          <span className="text-4xl">🌱</span>
          <p className="mt-3 text-gray-500">No programs yet. Create your first SELP program.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => (
            <Link key={p.id} to={`/programs/${p.id}`} className="card p-5 hover:shadow-md transition-shadow block">
              <div className="flex items-start justify-between mb-2">
                <h2 className="font-semibold text-gray-900 text-base leading-tight">{p.name}</h2>
                <span className={STATUS_COLORS[p.status]}>{p.status.charAt(0) + p.status.slice(1).toLowerCase()}</span>
              </div>
              {p.location && (
                <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
                  <MapPinIcon className="w-4 h-4" /> {p.location}
                </div>
              )}
              {(p.startDate || p.endDate) && (
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <CalendarIcon className="w-4 h-4" />
                  {p.startDate ? format(new Date(p.startDate), 'MMM d, yyyy') : '—'}
                  {' → '}
                  {p.endDate ? format(new Date(p.endDate), 'MMM d, yyyy') : '—'}
                </div>
              )}
              <div className="mt-3 text-xs text-blue-600 font-medium uppercase tracking-wide">{p.myRole?.replace(/_/g, ' ')}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
