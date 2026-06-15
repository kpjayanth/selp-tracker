const router = require('express').Router();
const { getPrisma } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getProgramRole } = require('../middleware/rbac');

router.get('/programs/:programId/audit', requireAuth, async (req, res) => {
  const { programId } = req.params;
  const role = await getProgramRole(req.user.id, programId);
  if (!['LEADER', 'PROGRAM_COACH'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

  const prisma = getPrisma();
  // Get audit logs related to this program's participants and the program itself
  const participants = await prisma.participant.findMany({ where: { programId }, select: { id: true } });
  const pids = participants.map((p) => p.id);

  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entity: 'Program', entityId: programId },
        { entity: 'Group', entityId: { in: await (async () => {
          const groups = await prisma.group.findMany({ where: { programId }, select: { id: true } });
          return groups.map((g) => g.id);
        })() } },
        { participantId: { in: pids } },
      ],
    },
    include: { actor: { select: { id: true, fullName: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(logs);
});

module.exports = router;
