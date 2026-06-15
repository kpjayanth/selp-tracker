import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getProgram, getGroups, getParticipants, createGroup, updateGroup, deleteGroup,
  createParticipant, moveParticipant, addMember, removeMember, search,
} from '../api';
import toast from 'react-hot-toast';
import {
  PlusIcon, MagnifyingGlassIcon, ArrowUpTrayIcon, ClipboardDocumentListIcon,
  PencilIcon, TrashIcon, UserPlusIcon,
} from '@heroicons/react/24/outline';

const ROLE_LABELS = { LEADER: 'Leader', PROGRAM_COACH: 'Program Coach', HEAD_COACH: 'Head Coach', COACH: 'Coach' };
const ROLE_COLORS = {
  LEADER: 'bg-purple-100 text-purple-800',
  PROGRAM_COACH: 'bg-blue-100 text-blue-800',
  HEAD_COACH: 'bg-indigo-100 text-indigo-800',
  COACH: 'bg-green-100 text-green-800',
};

export default function ProgramDetail() {
  const { programId } = useParams();
  const [program, setProgram] = useState(null);
  const [groups, setGroups] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [tab, setTab] = useState('participants');
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [participantForm, setParticipantForm] = useState({ firstName: '', lastName: '', phone: '', groupId: '' });
  const [groupForm, setGroupForm] = useState({ groupNumber: '', name: '' });
  const [memberForm, setMemberForm] = useState({ email: '', fullName: '', role: 'COACH', temporaryPassword: '' });
  const [saving, setSaving] = useState(false);

  const canManageGroups = ['LEADER', 'PROGRAM_COACH', 'HEAD_COACH'].includes(myRole);
  const canImport = ['LEADER', 'PROGRAM_COACH', 'HEAD_COACH'].includes(myRole);
  const canManageMembers = ['LEADER', 'PROGRAM_COACH'].includes(myRole);

  const load = useCallback(async () => {
    try {
      const [prog, grps, parts] = await Promise.all([
        getProgram(programId), getGroups(programId), getParticipants(programId),
      ]);
      setProgram(prog.data);
      setMyRole(prog.data.myRole);
      setGroups(grps.data);
      setParticipants(parts.data);
    } catch {
      toast.error('Failed to load program');
    }
  }, [programId]);

  useEffect(() => { load(); }, [load]);

  async function doSearch(q) {
    if (!q || q.length < 2) { setSearchResults(null); return; }
    try {
      const { data } = await search(programId, q);
      setSearchResults(data);
    } catch { /* ignore */ }
  }

  async function handleAddParticipant(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await createParticipant(programId, { ...participantForm, groupId: participantForm.groupId || undefined });
      await load();
      setShowAddParticipant(false);
      setParticipantForm({ firstName: '', lastName: '', phone: '', groupId: '' });
      toast.success('Participant added');
    } catch { toast.error('Failed to add participant'); }
    finally { setSaving(false); }
  }

  async function handleAddGroup(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await createGroup(programId, { groupNumber: Number(groupForm.groupNumber), name: groupForm.name });
      await load();
      setShowAddGroup(false);
      setGroupForm({ groupNumber: '', name: '' });
      toast.success('Group created');
    } catch { toast.error('Failed to create group'); }
    finally { setSaving(false); }
  }

  async function handleAddMember(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await addMember(programId, memberForm);
      await load();
      setShowAddMember(false);
      setMemberForm({ email: '', fullName: '', role: 'COACH', temporaryPassword: '' });
      toast.success('Member added');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add member'); }
    finally { setSaving(false); }
  }

  async function handleMove(participantId, groupId) {
    try {
      await moveParticipant(participantId, groupId || null);
      await load();
      toast.success('Moved');
    } catch { toast.error('Failed to move participant'); }
  }

  const displayParticipants = searchResults !== null ? searchResults : participants;

  if (!program) return <div className="py-12 text-center text-gray-400">Loading…</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link to="/programs" className="hover:text-blue-600">Programs</Link>
            <span>/</span>
            <span className="text-gray-800 font-medium">{program.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{program.name}</h1>
          <div className="flex gap-2 mt-1 flex-wrap">
            <span className={`badge ${ROLE_COLORS[myRole]}`}>{ROLE_LABELS[myRole]}</span>
            <span className="badge bg-gray-100 text-gray-700">{program.status}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canImport && (
            <Link to={`/programs/${programId}/import`} className="btn-secondary">
              <ArrowUpTrayIcon className="w-4 h-4" /> Import Excel
            </Link>
          )}
          {canManageMembers && (
            <Link to={`/programs/${programId}/audit`} className="btn-secondary">
              <ClipboardDocumentListIcon className="w-4 h-4" /> Audit Log
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        {['participants', 'groups', 'team'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'participants' && ` (${participants.length})`}
            {t === 'groups' && ` (${groups.length})`}
            {t === 'team' && ` (${program.roles?.length || 0})`}
          </button>
        ))}
      </div>

      {/* Participants tab */}
      {tab === 'participants' && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-48">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input pl-9" placeholder="Search participants…"
                value={searchQ}
                onChange={(e) => { setSearchQ(e.target.value); doSearch(e.target.value); }}
              />
            </div>
            <button className="btn-primary" onClick={() => setShowAddParticipant(true)}>
              <PlusIcon className="w-4 h-4" /> Add Participant
            </button>
          </div>

          {showAddParticipant && (
            <div className="card p-5 mb-4">
              <h3 className="font-semibold mb-3">Add Participant</h3>
              <form onSubmit={handleAddParticipant} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">First Name *</label>
                  <input className="input" required value={participantForm.firstName} onChange={(e) => setParticipantForm({ ...participantForm, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input className="input" required value={participantForm.lastName} onChange={(e) => setParticipantForm({ ...participantForm, lastName: e.target.value })} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" type="tel" value={participantForm.phone} onChange={(e) => setParticipantForm({ ...participantForm, phone: e.target.value })} />
                </div>
                <div>
                  <label className="label">Group</label>
                  <select className="input" value={participantForm.groupId} onChange={(e) => setParticipantForm({ ...participantForm, groupId: e.target.value })}>
                    <option value="">— No group yet —</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>Group {g.groupNumber}{g.name ? ` — ${g.name}` : ''}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add'}</button>
                  <button type="button" className="btn-secondary" onClick={() => setShowAddParticipant(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div className="card overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 hidden sm:table-cell">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Group</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 hidden md:table-cell">Project</th>
                  {canManageGroups && <th className="px-4 py-3 text-left font-medium text-gray-500">Move to</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayParticipants.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No participants found</td></tr>
                )}
                {displayParticipants.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/participants/${p.id}`} className="font-medium text-blue-700 hover:underline">
                        {p.firstName} {p.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{p.phone ? `···· ${p.phone.slice(-4)}` : '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.group ? `Group ${p.group.groupNumber}${p.group.name ? ` — ${p.group.name}` : ''}` : <span className="text-gray-400">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell max-w-xs truncate">
                      {p.project?.projectName || <span className="text-gray-400">—</span>}
                    </td>
                    {canManageGroups && (
                      <td className="px-4 py-3">
                        <select
                          className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white"
                          value={p.groupId || ''}
                          onChange={(e) => handleMove(p.id, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {groups.map((g) => <option key={g.id} value={g.id}>Group {g.groupNumber}{g.name ? ` — ${g.name}` : ''}</option>)}
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Groups tab */}
      {tab === 'groups' && (
        <div>
          {canManageGroups && (
            <div className="mb-4 flex gap-2">
              <button className="btn-primary" onClick={() => setShowAddGroup(true)}>
                <PlusIcon className="w-4 h-4" /> Add Group
              </button>
            </div>
          )}
          {showAddGroup && (
            <div className="card p-5 mb-4">
              <h3 className="font-semibold mb-3">Create Group</h3>
              <form onSubmit={handleAddGroup} className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="label">Group Number *</label>
                  <input type="number" className="input w-32" required value={groupForm.groupNumber} onChange={(e) => setGroupForm({ ...groupForm, groupNumber: e.target.value })} />
                </div>
                <div>
                  <label className="label">Name (optional)</label>
                  <input className="input" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} />
                </div>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create'}</button>
                <button type="button" className="btn-secondary" onClick={() => setShowAddGroup(false)}>Cancel</button>
              </form>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <div key={g.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Group {g.groupNumber}{g.name ? ` — ${g.name}` : ''}</h3>
                  <span className="text-sm text-gray-500">{g._count?.participants ?? 0} participants</span>
                </div>
                <div className="text-sm text-gray-600">
                  {g.coaches.length === 0 ? <span className="text-gray-400">No coach assigned</span>
                    : g.coaches.map((c) => <div key={c.user.id}>Coach: {c.user.fullName}</div>)}
                </div>
              </div>
            ))}
            {groups.length === 0 && <p className="text-gray-400 text-sm">No groups yet.</p>}
          </div>
        </div>
      )}

      {/* Team tab */}
      {tab === 'team' && (
        <div>
          {canManageMembers && (
            <div className="mb-4">
              <button className="btn-primary" onClick={() => setShowAddMember(true)}>
                <UserPlusIcon className="w-4 h-4" /> Add Team Member
              </button>
            </div>
          )}
          {showAddMember && (
            <div className="card p-5 mb-4">
              <h3 className="font-semibold mb-3">Add / Invite Team Member</h3>
              <form onSubmit={handleAddMember} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Email *</label>
                  <input type="email" className="input" required value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Full Name (if new user)</label>
                  <input className="input" value={memberForm.fullName} onChange={(e) => setMemberForm({ ...memberForm, fullName: e.target.value })} />
                </div>
                <div>
                  <label className="label">Role *</label>
                  <select className="input" value={memberForm.role} onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Temporary Password (if new user)</label>
                  <input type="password" className="input" value={memberForm.temporaryPassword} onChange={(e) => setMemberForm({ ...memberForm, temporaryPassword: e.target.value })} />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add Member'}</button>
                  <button type="button" className="btn-secondary" onClick={() => setShowAddMember(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}
          <div className="card overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
                  {canManageMembers && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(program.roles || []).map((r) => (
                  <tr key={r.user.id}>
                    <td className="px-4 py-3 font-medium">{r.user.fullName}</td>
                    <td className="px-4 py-3 text-gray-500">{r.user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${ROLE_COLORS[r.role]}`}>{ROLE_LABELS[r.role]}</span>
                    </td>
                    {canManageMembers && (
                      <td className="px-4 py-3 text-right">
                        <button
                          className="text-red-500 hover:text-red-700 text-xs"
                          onClick={async () => { await removeMember(programId, r.user.id); await load(); toast.success('Removed'); }}
                        >Remove</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
