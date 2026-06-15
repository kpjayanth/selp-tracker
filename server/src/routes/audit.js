const router = require('express').Router();
const { getPrisma } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getProgramRole } = require('../middleware/rbac');
const ah = require('../utils/asyncHandler');

router.get('/programs/:programId/audit', requireAuth, ah(async (req, res) => {
  const { programId } = req.params;
  const role = await getProgramRole(req.user.id, programId);
  if (!['LEADER', 'PROGRAM_COACH'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
  const prisma = getPrisma();
  const participants = await prisma.participant.findMany({ where: { programId }, select: { id: true } });
  const pids = participants.map((p) => p.id);
  const groups = await prisma.group.findMany({ where: { programId }, select: { id: true } });
  const gids = groups.map((g) => g.id);
  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entity: 'Program', entityId: programId },
        { entity: 'Group', entityId: { in: gids } },
        { participantId: { in: pids } },
      ],
    },
    include: { actor: { select: { id: true, fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(logs);
}));

module.exports = router;
