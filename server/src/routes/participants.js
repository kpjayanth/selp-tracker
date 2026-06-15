const router = require('express').Router();
const { z } = require('zod');
const { getPrisma } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getProgramRole, getCoachGroups, canAccessParticipant, requireProgramRoleMin } = require('../middleware/rbac');
const { encryptParticipant, decryptParticipant } = require('../services/encryption');
const { log } = require('../services/audit');
const ah = require('../utils/asyncHandler');

const participantInclude = {
  group: { select: { id: true, groupNumber: true, name: true } },
  project: { select: { id: true, projectName: true, projectDescription: true } },
};

async function listParticipantsForUser(userId, programId, role) {
  const prisma = getPrisma();
  let where = { programId, isDeleted: false };
  if (role === 'COACH') {
    const groups = await getCoachGroups(userId, programId);
    where.groupId = { in: groups };
  }
  const rows = await prisma.participant.findMany({ where, include: participantInclude, orderBy: { createdAt: 'desc' } });
  return rows.map(decryptParticipant);
}

router.get('/programs/:programId/participants', requireAuth, ah(async (req, res) => {
  const role = await getProgramRole(req.user.id, req.params.programId);
  if (!role) return res.status(403).json({ error: 'Forbidden' });
  res.json(await listParticipantsForUser(req.user.id, req.params.programId, role));
}));

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  groupId: z.string().optional(),
  family: z.string().optional(),
  whatsImportant: z.string().optional(),
  whyJoined: z.string().optional(),
  whatAccomplish: z.string().optional(),
});

router.post('/programs/:programId/participants', requireAuth, ah(async (req, res) => {
  const role = await getProgramRole(req.user.id, req.params.programId);
  if (!role) return res.status(403).json({ error: 'Forbidden' });
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.errors });
  const enc = encryptParticipant(parse.data);
  const prisma = getPrisma();
  const participant = await prisma.participant.create({
    data: { ...enc, programId: req.params.programId, groupId: parse.data.groupId || null },
    include: participantInclude,
  });
  await log({
    actorUserId: req.user.id, action: 'CREATE', entity: 'Participant',
    entityId: participant.id, participantId: participant.id,
    after: { firstName: parse.data.firstName, lastName: parse.data.lastName },
  });
  res.status(201).json(decryptParticipant(participant));
}));

router.get('/participants/:participantId', requireAuth, ah(async (req, res) => {
  const prisma = getPrisma();
  const raw = await prisma.participant.findUnique({
    where: { id: req.params.participantId },
    include: { ...participantInclude, project: true },
  });
  if (!raw) return res.status(404).json({ error: 'Not found' });
  const role = await getProgramRole(req.user.id, raw.programId);
  if (!(await canAccessParticipant(req.user.id, raw, role))) return res.status(403).json({ error: 'Forbidden' });
  res.json(decryptParticipant(raw));
}));

const updateSchema = createSchema.partial();

router.patch('/participants/:participantId', requireAuth, ah(async (req, res) => {
  const prisma = getPrisma();
  const raw = await prisma.participant.findUnique({ where: { id: req.params.participantId } });
  if (!raw) return res.status(404).json({ error: 'Not found' });
  const role = await getProgramRole(req.user.id, raw.programId);
  if (!(await canAccessParticipant(req.user.id, raw, role))) return res.status(403).json({ error: 'Forbidden' });
  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.errors });
  const current = decryptParticipant(raw);
  const merged = { ...current, ...parse.data };
  const enc = encryptParticipant(merged);
  const updated = await prisma.participant.update({
    where: { id: req.params.participantId },
    data: { ...enc, groupId: parse.data.groupId !== undefined ? parse.data.groupId : raw.groupId },
    include: participantInclude,
  });
  await log({ actorUserId: req.user.id, action: 'UPDATE', entity: 'Participant', entityId: raw.id, participantId: raw.id });
  res.json(decryptParticipant(updated));
}));

router.patch('/participants/:participantId/move', requireAuth, requireProgramRoleMin('HEAD_COACH'), ah(async (req, res) => {
  const { groupId } = req.body;
  const prisma = getPrisma();
  const raw = await prisma.participant.findUnique({ where: { id: req.params.participantId } });
  if (!raw) return res.status(404).json({ error: 'Not found' });
  const updated = await prisma.participant.update({
    where: { id: req.params.participantId },
    data: { groupId: groupId || null },
    include: participantInclude,
  });
  await log({ actorUserId: req.user.id, action: 'MOVE_GROUP', entity: 'Participant', entityId: raw.id, participantId: raw.id, after: { groupId } });
  res.json(decryptParticipant(updated));
}));

router.delete('/participants/:participantId', requireAuth, ah(async (req, res) => {
  const prisma = getPrisma();
  const raw = await prisma.participant.findUnique({ where: { id: req.params.participantId } });
  if (!raw) return res.status(404).json({ error: 'Not found' });
  const role = await getProgramRole(req.user.id, raw.programId);
  if (role !== 'LEADER') return res.status(403).json({ error: 'Forbidden' });
  await prisma.participant.update({
    where: { id: req.params.participantId },
    data: { isDeleted: true, deletedAt: new Date() },
  });
  await log({ actorUserId: req.user.id, action: 'SOFT_DELETE', entity: 'Participant', entityId: raw.id, participantId: raw.id });
  res.json({ message: 'Deleted' });
}));

module.exports = router;
