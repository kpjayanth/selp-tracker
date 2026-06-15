const { getPrisma } = require('../db');

const ROLE_RANK = { LEADER: 4, PROGRAM_COACH: 3, HEAD_COACH: 2, COACH: 1 };

async function getProgramRole(userId, programId) {
  const prisma = getPrisma();
  const pr = await prisma.programRole.findUnique({ where: { programId_userId: { programId, userId } } });
  return pr?.role || null;
}

async function getCoachGroups(userId, programId) {
  const prisma = getPrisma();
  const gcs = await prisma.groupCoach.findMany({
    where: { userId, group: { programId } },
    select: { groupId: true },
  });
  return gcs.map((g) => g.groupId);
}

function requireProgramRole(...roles) {
  return async (req, res, next) => {
    const programId = req.params.programId || req.body.programId;
    if (!programId) return res.status(400).json({ error: 'programId required' });
    const role = await getProgramRole(req.user.id, programId);
    if (!role || !roles.includes(role)) return res.status(403).json({ error: 'Forbidden' });
    req.programRole = role;
    req.programId = programId;
    next();
  };
}

function requireProgramRoleMin(minRole) {
  return async (req, res, next) => {
    const programId = req.params.programId || req.body.programId;
    if (!programId) return res.status(400).json({ error: 'programId required' });
    const role = await getProgramRole(req.user.id, programId);
    if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) return res.status(403).json({ error: 'Forbidden' });
    req.programRole = role;
    req.programId = programId;
    next();
  };
}

async function canAccessParticipant(userId, participant, programRole) {
  if (!participant || participant.isDeleted) return false;
  if (['LEADER', 'PROGRAM_COACH', 'HEAD_COACH'].includes(programRole)) return true;
  if (programRole === 'COACH') {
    if (!participant.groupId) return false;
    const coachGroups = await getCoachGroups(userId, participant.programId);
    return coachGroups.includes(participant.groupId);
  }
  return false;
}

module.exports = { getProgramRole, getCoachGroups, requireProgramRole, requireProgramRoleMin, canAccessParticipant, ROLE_RANK };
