const { getPrisma } = require('../db');

async function log({ actorUserId, action, entity, entityId, participantId, before, after }) {
  const prisma = getPrisma();
  await prisma.auditLog.create({
    data: { actorUserId, action, entity, entityId, participantId: participantId || null, before: before || null, after: after || null },
  });
}

module.exports = { log };
