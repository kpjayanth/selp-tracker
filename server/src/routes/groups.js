const router = require('express').Router();
const { z } = require('zod');
const { getPrisma } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireProgramRoleMin, getProgramRole, getCoachGroups } = require('../middleware/rbac');
const { log } = require('../services/audit');
const ah = require('../utils/asyncHandler');

router.get('/programs/:programId/groups', requireAuth, ah(async (req, res) => {
  const { programId } = req.params;
  const role = await getProgramRole(req.user.id, programId);
  if (!role) return res.status(403).json({ error: 'Forbidden' });
  const prisma = getPrisma();
  let groupWhere = { programId };
  if (role === 'COACH') {
    const coachGroupIds = await getCoachGroups(req.user.id, programId);
    groupWhere = { ...groupWhere, id: { in: coachGroupIds } };
  }
  const groups = await prisma.group.findMany({
    where: groupWhere,
    include: {
      coaches: { include: { user: { select: { id: true, fullName: true, email: true } } } },
      _count: { select: { participants: { where: { isDeleted: false } } } },
    },
    orderBy: { groupNumber: 'asc' },
  });
  res.json(groups);
}));

const createGroupSchema = z.object({
  groupNumber: z.number().int().positive(),
  name: z.string().optional(),
  coachUserIds: z.array(z.string()).optional(),
});

router.post('/programs/:programId/groups', requireAuth, requireProgramRoleMin('HEAD_COACH'), ah(async (req, res) => {
  const parse = createGroupSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.errors });
  const { groupNumber, name, coachUserIds } = parse.data;
  const prisma = getPrisma();
  const group = await prisma.group.create({
    data: {
      programId: req.params.programId,
      groupNumber,
      name,
      coaches: coachUserIds ? { create: coachUserIds.map((uid) => ({ userId: uid })) } : undefined,
    },
    include: { coaches: { include: { user: { select: { id: true, fullName: true, email: true } } } } },
  });
  await log({ actorUserId: req.user.id, action: 'CREATE', entity: 'Group', entityId: group.id });
  res.status(201).json(group);
}));

router.patch('/programs/:programId/groups/:groupId', requireAuth, requireProgramRoleMin('HEAD_COACH'), ah(async (req, res) => {
  const { groupId } = req.params;
  const prisma = getPrisma();
  const { name, groupNumber, coachUserIds } = req.body;
  const group = await prisma.group.update({
    where: { id: groupId },
    data: {
      name,
      groupNumber,
      ...(coachUserIds !== undefined && {
        coaches: { deleteMany: {}, create: coachUserIds.map((uid) => ({ userId: uid })) },
      }),
    },
    include: { coaches: { include: { user: { select: { id: true, fullName: true, email: true } } } } },
  });
  await log({ actorUserId: req.user.id, action: 'UPDATE', entity: 'Group', entityId: group.id });
  res.json(group);
}));

router.delete('/programs/:programId/groups/:groupId', requireAuth, requireProgramRoleMin('HEAD_COACH'), ah(async (req, res) => {
  const prisma = getPrisma();
  await prisma.group.delete({ where: { id: req.params.groupId } });
  res.json({ message: 'Deleted' });
}));

module.exports = router;
