import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getGroups, importPreview, importCommit } from '../api';
import toast from 'react-hot-toast';
import { ArrowUpTrayIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const STATUS_COLORS = { CREATE: 'bg-green-100 text-green-800', UPDATE: 'bg-blue-100 text-blue-800', SKIP: 'bg-gray-100 text-gray-500' };

export default function ImportPage() {
  const { programId } = useParams();
  const [groups, setGroups] = useState([]);
  const [file, setFile] = useState(null);
  const [groupId, setGroupId] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { getGroups(programId).then((r) => setGroups(r.data)); }, [programId]);

  async function handlePreview(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    try {
      const { data } = await importPreview(programId, file);
      setPreview(data);
    } catch { toast.error('Preview failed — check file format'); }
    finally { setLoading(false); }
  }

  async function handleCommit() {
    if (!file) return;
    setLoading(true);
    try {
      const { data } = await importCommit(programId, file, groupId || undefined);
      setResult(data);
      setPreview(null);
      toast.success(`Import complete: ${data.created} created, ${data.updated} updated`);
    } catch { toast.error('Import failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to={`/programs/${programId}`} className="hover:text-blue-600">Program</Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">Import Excel</span>
      </div>

      <h1 className="text-2xl font-bold mb-1">Import from Excel</h1>
      <p className="text-sm text-gray-500 mb-6">Upload a <code>.xlsx</code> file matching the SELP intake format (12 columns). Preview changes before committing.</p>

      {result ? (
        <div className="card p-6 text-center">
          <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h2 className="font-semibold text-lg mb-2">Import Complete</h2>
          <div className="flex justify-center gap-6 text-sm">
            <div><div className="text-2xl font-bold text-green-600">{result.created}</div><div className="text-gray-500">Created</div></div>
            <div><div className="text-2xl font-bold text-blue-600">{result.updated}</div><div className="text-gray-500">Updated</div></div>
            <div><div className="text-2xl font-bold text-gray-400">{result.skipped}</div><div className="text-gray-500">Skipped</div></div>
          </div>
          {result.errors?.length > 0 && (
            <div className="mt-4 text-left text-sm text-red-600 bg-red-50 rounded p-3">
              {result.errors.map((e, i) => <div key={i}>{e.name}: {e.error}</div>)}
            </div>
          )}
          <Link to={`/programs/${programId}`} className="btn-primary mt-4 inline-flex">Back to Program</Link>
        </div>
      ) : (
        <>
          <div className="card p-5 mb-4">
            <form onSubmit={handlePreview} className="space-y-4">
              <div>
                <label className="label">Excel File (.xlsx) *</label>
                <input type="file" accept=".xlsx,.xls" className="block text-sm text-gray-600 file:mr-3 file:btn file:btn-secondary file:cursor-pointer"
                  onChange={(e) => { setFile(e.target.files[0]); setPreview(null); setResult(null); }} />
              </div>
              <div>
                <label className="label">Assign imported participants to group</label>
                <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  <option value="">— No group (assign later) —</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>Group {g.groupNumber}{g.name ? ` — ${g.name}` : ''}</option>)}
                </select>
              </div>
              <button type="submit" className="btn-primary" disabled={!file || loading}>
                <ArrowUpTrayIcon className="w-4 h-4" /> {loading ? 'Previewing…' : 'Preview Import'}
              </button>
            </form>
          </div>

          {preview && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Preview</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {preview.summary.create} to create · {preview.summary.update} to update · {preview.summary.skip} to skip
                  </p>
                </div>
                <button className="btn-primary" onClick={handleCommit} disabled={loading}>
                  {loading ? 'Importing…' : 'Commit Import'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Name</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Project Name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2"><span className={`badge ${STATUS_COLORS[r.status]}`}>{r.status}</span></td>
                        <td className="px-4 py-2 font-medium">{r.row.firstName} {r.row.lastName}</td>
                        <td className="px-4 py-2 text-gray-500 max-w-xs truncate">{r.row.projectName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
