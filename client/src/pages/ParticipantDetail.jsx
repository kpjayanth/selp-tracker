import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getParticipant, updateParticipant, getProject, upsertProject, addUpdate, addComment, addVideo, uploadPhoto } from '../api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { PencilIcon, CheckIcon, XMarkIcon, PaperClipIcon, VideoCameraIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';

const PROJECT_FIELDS = [
  { key: 'projectName', label: 'Project Name' },
  { key: 'whoIAmPossibility', label: 'Who I am is the possibility of' },
  { key: 'targetCommunity', label: 'My target community is' },
  { key: 'projectPossibility', label: 'The possibility of my project is' },
  { key: 'projectDescription', label: 'My community project is' },
  { key: 'smrEndOfProgram', label: 'Specific measurable results by end of program' },
  { key: 'milestoneWorkday3', label: 'Milestone — Workday 3' },
  { key: 'milestoneWorkday2', label: 'Milestone — Workday 2' },
  { key: 'promotionResources', label: 'Other promotion resources' },
  { key: 'forumRegistrations', label: 'Forum registrations' },
];

const PROFILE_FIELDS = [
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'family', label: 'Family' },
  { key: 'whatsImportant', label: "What's important to them" },
  { key: 'whyJoined', label: 'Why they joined SELP' },
  { key: 'whatAccomplish', label: 'What they want to accomplish' },
];

function EditableField({ value, onSave, multiline, label, type }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  async function save() {
    await onSave(draft);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex gap-2 items-start">
        {multiline ? (
          <textarea className="input flex-1 min-h-24 text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
        ) : (
          <input type={type || 'text'} className="input flex-1 text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
        )}
        <button onClick={save} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><CheckIcon className="w-4 h-4" /></button>
        <button onClick={() => { setEditing(false); setDraft(value || ''); }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><XMarkIcon className="w-4 h-4" /></button>
      </div>
    );
  }

  return (
    <div
      className="group flex gap-2 items-start cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5 -mx-1"
      onClick={() => { setDraft(value || ''); setEditing(true); }}
    >
      <span className={`flex-1 text-sm ${value ? 'text-gray-800' : 'text-gray-400 italic'}`}>
        {value || `Click to add ${label.toLowerCase()}…`}
      </span>
      <PencilIcon className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 shrink-0 mt-0.5" />
    </div>
  );
}

export default function ParticipantDetail() {
  const { participantId } = useParams();
  const [participant, setParticipant] = useState(null);
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState('profile');
  const [updateText, setUpdateText] = useState('');
  const [updateStatus, setUpdateStatus] = useState('');
  const [commentText, setCommentText] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [activeUpdateId, setActiveUpdateId] = useState(null);
  const [saving, setSaving] = useState(false);

  async function loadAll() {
    const [p, proj] = await Promise.all([getParticipant(participantId), getProject(participantId).catch(() => ({ data: null }))]);
    setParticipant(p.data);
    setProject(proj.data);
  }

  useEffect(() => { loadAll(); }, [participantId]);

  async function saveProfile(field, value) {
    try {
      const updated = await updateParticipant(participantId, { [field]: value });
      setParticipant(updated.data);
      toast.success('Saved');
    } catch { toast.error('Save failed'); }
  }

  async function saveProject(field, value) {
    try {
      const data = { ...(project || {}), [field]: value };
      const updated = await upsertProject(participantId, data);
      setProject(updated.data);
      toast.success('Saved');
    } catch { toast.error('Save failed'); }
  }

  async function handleAddUpdate(e) {
    e.preventDefault();
    if (!updateText.trim()) return;
    setSaving(true);
    try {
      await addUpdate(project.id, { body: updateText, progressStatus: updateStatus });
      await loadAll();
      setUpdateText(''); setUpdateStatus('');
      toast.success('Update added');
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await addComment(project.id, { body: commentText, updateId: activeUpdateId || undefined });
      await loadAll();
      setCommentText(''); setActiveUpdateId(null);
      toast.success('Comment added');
    } catch { toast.error('Failed'); }
  }

  async function handleAddVideo(e) {
    e.preventDefault();
    if (!videoUrl.trim()) return;
    try {
      await addVideo(project.id, { url: videoUrl });
      await loadAll();
      setVideoUrl('');
      toast.success('Video link added');
    } catch { toast.error('Failed'); }
  }

  async function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await uploadPhoto(project.id, file);
      await loadAll();
      toast.success('Photo uploaded');
    } catch { toast.error('Upload failed'); }
  }

  if (!participant) return <div className="py-12 text-center text-gray-400">Loading…</div>;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/programs" className="hover:text-blue-600">Programs</Link>
        <span>/</span>
        {participant.group && (
          <>
            <span>Group {participant.group.groupNumber}</span>
            <span>/</span>
          </>
        )}
        <span className="text-gray-800 font-medium">{participant.firstName} {participant.lastName}</span>
      </div>

      <h1 className="text-2xl font-bold mb-1">{participant.firstName} {participant.lastName}</h1>
      {participant.group && (
        <p className="text-sm text-gray-500 mb-4">Group {participant.group.groupNumber}{participant.group.name ? ` — ${participant.group.name}` : ''}</p>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        {['profile', 'project', 'timeline'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Profile */}
      {tab === 'profile' && (
        <div className="card p-5 max-w-2xl">
          <h2 className="font-semibold mb-4">Profile</h2>
          <div className="space-y-4">
            {PROFILE_FIELDS.map(({ key, label, type }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <EditableField
                  label={label} type={type}
                  value={participant[key]}
                  multiline={key !== 'phone'}
                  onSave={(v) => saveProfile(key, v)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project */}
      {tab === 'project' && (
        <div className="card p-5 max-w-2xl">
          <h2 className="font-semibold mb-4">Community Project</h2>
          <div className="space-y-4">
            {PROJECT_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <EditableField
                  label={label} multiline={key !== 'projectName'}
                  value={project?.[key]}
                  onSave={(v) => saveProject(key, v)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {tab === 'timeline' && (
        <div className="max-w-2xl space-y-6">
          {!project ? (
            <div className="card p-5 text-gray-400 text-center">No project yet — add project details first.</div>
          ) : (
            <>
              {/* Add update */}
              <div className="card p-4">
                <h3 className="font-medium mb-3 text-sm">Post Progress Update</h3>
                <form onSubmit={handleAddUpdate} className="space-y-2">
                  <input className="input text-sm" placeholder="Status / milestone (optional)" value={updateStatus} onChange={(e) => setUpdateStatus(e.target.value)} />
                  <textarea className="input text-sm min-h-20" placeholder="Describe progress…" value={updateText} onChange={(e) => setUpdateText(e.target.value)} />
                  <div className="flex gap-2 items-center">
                    <button type="submit" className="btn-primary text-xs py-1.5" disabled={saving || !updateText.trim()}>Post Update</button>
                    {/* Photo upload */}
                    <label className="btn-secondary text-xs py-1.5 cursor-pointer">
                      <PaperClipIcon className="w-3.5 h-3.5" /> Photo
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                    </label>
                    {/* Video link */}
                    <form onSubmit={handleAddVideo} className="flex gap-1 flex-1">
                      <input className="input text-xs py-1.5 flex-1" placeholder="Video URL…" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
                      <button type="submit" className="btn-secondary text-xs py-1.5"><VideoCameraIcon className="w-3.5 h-3.5" /></button>
                    </form>
                  </div>
                </form>
              </div>

              {/* Photo & video gallery */}
              {(project.mediaAssets?.length > 0) && (
                <div className="card p-4">
                  <h3 className="font-medium mb-3 text-sm">Media</h3>
                  <div className="flex flex-wrap gap-3">
                    {project.mediaAssets.map((m) => (
                      m.type === 'PHOTO'
                        ? <img key={m.id} src={`/uploads/${m.storageKey}`} alt={m.originalName} className="w-24 h-24 object-cover rounded-lg border" />
                        : <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline badge bg-blue-50">
                            <VideoCameraIcon className="w-3.5 h-3.5" /> Video link
                          </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Updates timeline */}
              <div className="space-y-4">
                {(project.updates || []).map((u) => (
                  <div key={u.id} className="card p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        {u.progressStatus && <span className="badge bg-blue-100 text-blue-800 mb-1">{u.progressStatus}</span>}
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{u.body}</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {u.author.fullName} · {format(new Date(u.createdAt), 'MMM d, yyyy h:mm a')}
                    </div>

                    {/* Update media */}
                    {u.mediaAssets?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {u.mediaAssets.map((m) => m.type === 'PHOTO'
                          ? <img key={m.id} src={`/uploads/${m.storageKey}`} alt="" className="w-16 h-16 object-cover rounded border" />
                          : <a key={m.id} href={m.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline badge bg-blue-50"><VideoCameraIcon className="w-3 h-3" /> Video</a>
                        )}
                      </div>
                    )}

                    {/* Comments on this update */}
                    {(u.comments || []).map((c) => (
                      <div key={c.id} className="mt-2 ml-4 border-l-2 border-gray-100 pl-3 text-sm">
                        <span className="font-medium text-gray-700">{c.author.fullName}</span>
                        <span className="text-gray-400 text-xs ml-2">{format(new Date(c.createdAt), 'MMM d h:mm a')}</span>
                        <p className="text-gray-600">{c.body}</p>
                      </div>
                    ))}

                    {/* Add comment to update */}
                    {activeUpdateId === u.id ? (
                      <form onSubmit={handleAddComment} className="mt-2 flex gap-2">
                        <input className="input text-xs flex-1" placeholder="Comment…" value={commentText} onChange={(e) => setCommentText(e.target.value)} autoFocus />
                        <button type="submit" className="btn-primary text-xs py-1">Post</button>
                        <button type="button" className="btn-secondary text-xs py-1" onClick={() => setActiveUpdateId(null)}>Cancel</button>
                      </form>
                    ) : (
                      <button onClick={() => setActiveUpdateId(u.id)} className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600">
                        <ChatBubbleLeftIcon className="w-3.5 h-3.5" /> Reply
                      </button>
                    )}
                  </div>
                ))}

                {/* Top-level comments */}
                {(project.comments || []).length > 0 && (
                  <div className="card p-4">
                    <h3 className="text-sm font-medium mb-2">Project Notes</h3>
                    {project.comments.map((c) => (
                      <div key={c.id} className="text-sm mb-2 last:mb-0">
                        <span className="font-medium">{c.author.fullName}</span>
                        <span className="text-gray-400 text-xs ml-2">{format(new Date(c.createdAt), 'MMM d h:mm a')}</span>
                        <p className="text-gray-600">{c.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Top-level comment form */}
                <div className="card p-4">
                  <form onSubmit={(e) => { e.preventDefault(); if (!commentText.trim()) return; addComment(project.id, { body: commentText }).then(() => { loadAll(); setCommentText(''); toast.success('Note added'); }).catch(() => toast.error('Failed')); }} className="flex gap-2">
                    <input className="input text-sm flex-1" placeholder="Add a note to this project…" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
                    <button type="submit" className="btn-secondary text-sm">Post</button>
                  </form>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
