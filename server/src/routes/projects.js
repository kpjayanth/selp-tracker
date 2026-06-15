const router = require('express').Router();
const { z } = require('zod');
const { getPrisma } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getProgramRole, canAccessParticipant } = require('../middleware/rbac');
const { log } = require('../services/audit');
const { getUpload } = require('../utils/upload');
const ah = require('../utils/asyncHandler');

const projectFields = [
  'whoIAmPossibility', 'targetCommunity', 'projectPossibility', 'projectDescription',
  'projectName', 'smrEndOfProgram', 'milestoneWorkday3', 'milestoneWorkday2',
  'promotionResources', 'forumRegistrations',
];

async function getParticipantWithAccess(req, participantId) {
  const prisma = getPrisma();
  const participant = await prisma.participant.findUnique({ where: { id: participantId } });
  if (!participant) return { error: 404 };
  const role = await getProgramRole(req.user.id, participant.programId);
  const ok = await canAccessParticipant(req.user.id, participant, role);
  if (!ok) return { error: 403 };
  return { participant, role };
}

router.get('/participants/:participantId/project', requireAuth, ah(async (req, res) => {
  const { error, participant } = await getParticipantWithAccess(req, req.params.participantId);
  if (error) return res.status(error).json({ error: error === 404 ? 'Not found' : 'Forbidden' });
  const prisma = getPrisma();
  const project = await prisma.communityProject.findUnique({
    where: { participantId: participant.id },
    include: {
      updates: {
        include: {
          author: { select: { id: true, fullName: true } },
          comments: { include: { author: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' } },
          mediaAssets: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      comments: {
        where: { updateId: null },
        include: { author: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'asc' },
      },
      mediaAssets: { where: { updateId: null }, orderBy: { createdAt: 'desc' } },
    },
  });
  res.json(project);
}));

router.put('/participants/:participantId/project', requireAuth, ah(async (req, res) => {
  const { error, participant } = await getParticipantWithAccess(req, req.params.participantId);
  if (error) return res.status(error).json({ error: error === 404 ? 'Not found' : 'Forbidden' });
  const data = {};
  for (const f of projectFields) if (req.body[f] !== undefined) data[f] = req.body[f];
  const prisma = getPrisma();
  const project = await prisma.communityProject.upsert({
    where: { participantId: participant.id },
    create: { participantId: participant.id, ...data },
    update: data,
  });
  await log({ actorUserId: req.user.id, action: 'UPSERT', entity: 'CommunityProject', entityId: project.id, participantId: participant.id });
  res.json(project);
}));

const updateSchema = z.object({ body: z.string().min(1), progressStatus: z.string().optional() });

router.post('/projects/:projectId/updates', requireAuth, ah(async (req, res) => {
  const prisma = getPrisma();
  const project = await prisma.communityProject.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: 'Not found' });
  const { error } = await getParticipantWithAccess(req, project.participantId);
  if (error) return res.status(error).json({ error: 'Forbidden' });
  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.errors });
  const update = await prisma.projectUpdate.create({
    data: { projectId: project.id, authorUserId: req.user.id, ...parse.data },
    include: { author: { select: { id: true, fullName: true } }, comments: true, mediaAssets: true },
  });
  res.status(201).json(update);
}));

const commentSchema = z.object({ body: z.string().min(1), updateId: z.string().optional() });

router.post('/projects/:projectId/comments', requireAuth, ah(async (req, res) => {
  const prisma = getPrisma();
  const project = await prisma.communityProject.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: 'Not found' });
  const { error } = await getParticipantWithAccess(req, project.participantId);
  if (error) return res.status(error).json({ error: 'Forbidden' });
  const parse = commentSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.errors });
  const comment = await prisma.comment.create({
    data: { projectId: project.id, updateId: parse.data.updateId || null, authorUserId: req.user.id, body: parse.data.body },
    include: { author: { select: { id: true, fullName: true } } },
  });
  res.status(201).json(comment);
}));

router.post('/projects/:projectId/photos', requireAuth, getUpload().single('photo'), ah(async (req, res) => {
  const prisma = getPrisma();
  const project = await prisma.communityProject.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: 'Not found' });
  const { error } = await getParticipantWithAccess(req, project.participantId);
  if (error) return res.status(error).json({ error: 'Forbidden' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const asset = await prisma.mediaAsset.create({
    data: {
      projectId: project.id,
      updateId: req.body.updateId || null,
      type: 'PHOTO',
      storageKey: req.file.filename,
      originalName: req.file.originalname,
      uploadedById: req.user.id,
    },
  });
  res.status(201).json(asset);
}));

router.post('/projects/:projectId/videos', requireAuth, ah(async (req, res) => {
  const { url, updateId } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  const prisma = getPrisma();
  const project = await prisma.communityProject.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: 'Not found' });
  const { error } = await getParticipantWithAccess(req, project.participantId);
  if (error) return res.status(error).json({ error: 'Forbidden' });
  const asset = await prisma.mediaAsset.create({
    data: { projectId: project.id, updateId: updateId || null, type: 'VIDEO_LINK', url, uploadedById: req.user.id },
  });
  res.status(201).json(asset);
}));

module.exports = router;
