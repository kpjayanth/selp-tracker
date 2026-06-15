const router = require('express').Router();
const { getPrisma } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getProgramRole, getCoachGroups } = require('../middleware/rbac');
const { hmacToken, decryptParticipant } = require('../services/encryption');
const ah = require('../utils/asyncHandler');

router.get('/programs/:programId/search', requireAuth, ah(async (req, res) => {
  const { programId } = req.params;
  const { q, type } = req.query;
  if (!q || q.length < 2) return res.json([]);
  const role = await getProgramRole(req.user.id, programId);
  if (!role) return res.status(403).json({ error: 'Forbidden' });
  const prisma = getPrisma();

  if (type === 'coach') {
    const members = await prisma.programRole.findMany({
      where: { programId },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    const lower = q.toLowerCase();
    const matches = members.filter((m) => m.user.fullName.toLowerCase().includes(lower) || m.user.email.toLowerCase().includes(lower));
    return res.json(matches.map((m) => ({ ...m.user, role: m.role })));
  }

  const token = hmacToken(q);
  let where = { programId, isDeleted: false };
  if (role === 'COACH') {
    const groups = await getCoachGroups(req.user.id, programId);
    where.groupId = { in: groups };
  }

  const byToken = await prisma.participant.findMany({
    where: { ...where, OR: [{ firstNameToken: token }, { lastNameToken: token }] },
    include: { group: { select: { id: true, groupNumber: true, name: true } }, project: { select: { id: true, projectName: true } } },
    take: 20,
  });

  const all = await prisma.participant.findMany({
    where,
    include: { group: { select: { id: true, groupNumber: true, name: true } }, project: { select: { id: true, projectName: true } } },
  });
  const lower = q.toLowerCase();
  const partial = all.map(decryptParticipant).filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(lower)).slice(0, 20);

  const tokenIds = new Set(byToken.map((r) => r.id));
  const merged = [...byToken.map(decryptParticipant), ...partial.filter((p) => !tokenIds.has(p.id))];
  res.json(merged.slice(0, 20));
}));

module.exports = router;
