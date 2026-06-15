import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAuditLog } from '../api';
import { format } from 'date-fns';

export default function AuditPage() {
  const { programId } = useParams();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAuditLog(programId).then((r) => setLogs(r.data)).finally(() => setLoading(false));
  }, [programId]);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to={`/programs/${programId}`} className="hover:text-blue-600">Program</Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">Audit Log</span>
      </div>
      <h1 className="text-2xl font-bold mb-6">Audit Log</h1>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="min-w-full text-sm divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Time</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Actor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Action</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{format(new Date(l.createdAt), 'MMM d, yyyy h:mm a')}</td>
                  <td className="px-4 py-2 font-medium">{l.actor.fullName}</td>
                  <td className="px-4 py-2"><span className="badge bg-gray-100 text-gray-700">{l.action}</span></td>
                  <td className="px-4 py-2 text-gray-600">{l.entity} <span className="text-gray-400 text-xs">#{l.entityId.slice(0, 8)}</span></td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No audit entries yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
