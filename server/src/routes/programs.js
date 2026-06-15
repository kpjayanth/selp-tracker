const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { getPrisma } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireProgramRoleMin, getProgramRole } = require('../middleware/rbac');
const { log } = require('../services/audit');
const ah = require('../utils/asyncHandler');

router.get('/', requireAuth, ah(async (req, res) => {
  const prisma = getPrisma();
  const roles = await prisma.programRole.findMany({
    where: { userId: req.user.id },
    include: { program: true },
  });
  res.json(roles.map((r) => ({ ...r.program, myRole: r.role })));
}));

const createProgramSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED']).default('PLANNED'),
});

router.post('/', requireAuth, ah(async (req, res) => {
  const parse = createProgramSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.errors });
  const data = parse.data;
  const prisma = getPrisma();
  const program = await prisma.program.create({
    data: {
      name: data.name,
      location: data.location,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      status: data.status,
      createdById: req.user.id,
      roles: { create: { userId: req.user.id, role: 'LEADER' } },
    },
  });
  await log({ actorUserId: req.user.id, action: 'CREATE', entity: 'Program', entityId: program.id });
  res.status(201).json({ ...program, myRole: 'LEADER' });
}));

router.get('/:programId', requireAuth, ah(async (req, res) => {
  const { programId } = req.params;
  const role = await getProgramRole(req.user.id, programId);
  if (!role) return res.status(403).json({ error: 'Forbidden' });
  const prisma = getPrisma();
  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: { roles: { include: { user: { select: { id: true, fullName: true, email: true } } } } },
  });
  if (!program) return res.status(404).json({ error: 'Not found' });
  res.json({ ...program, myRole: role });
}));

const updateProgramSchema = createProgramSchema.partial();

router.patch('/:programId', requireAuth, requireProgramRoleMin('LEADER'), ah(async (req, res) => {
  const parse = updateProgramSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.errors });
  const prisma = getPrisma();
  const program = await prisma.program.update({
    where: { id: req.params.programId },
    data: {
      ...parse.data,
      startDate: parse.data.startDate ? new Date(parse.data.startDate) : undefined,
      endDate: parse.data.endDate ? new Date(parse.data.endDate) : undefined,
    },
  });
  await log({ actorUserId: req.user.id, action: 'UPDATE', entity: 'Program', entityId: program.id });
  res.json(program);
}));

const assignRoleSchema = z.object({
  email: z.string().email(),
  role: z.enum(['LEADER', 'PROGRAM_COACH', 'HEAD_COACH', 'COACH']),
  fullName: z.string().optional(),
  temporaryPassword: z.string().optional(),
});

router.post('/:programId/members', requireAuth, requireProgramRoleMin('PROGRAM_COACH'), ah(async (req, res) => {
  const parse = assignRoleSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.errors });
  const { email, role, fullName, temporaryPassword } = parse.data;
  const prisma = getPrisma();
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const hash = await bcrypt.hash(temporaryPassword || 'Selp1234!', 12);
    user = await prisma.user.create({
      data: { fullName: fullName || email, email, passwordHash: hash, status: 'INVITED' },
    });
  }
  const existing = await prisma.programRole.findUnique({
    where: { programId_userId: { programId: req.params.programId, userId: user.id } },
  });
  if (existing) {
    await prisma.programRole.update({
      where: { programId_userId: { programId: req.params.programId, userId: user.id } },
      data: { role },
    });
  } else {
    await prisma.programRole.create({ data: { programId: req.params.programId, userId: user.id, role } });
  }
  await log({ actorUserId: req.user.id, action: 'ASSIGN_ROLE', entity: 'ProgramRole', entityId: user.id, after: { role } });
  res.json({ user: { id: user.id, fullName: user.fullName, email: user.email }, role });
}));

router.delete('/:programId/members/:userId', requireAuth, requireProgramRoleMin('PROGRAM_COACH'), ah(async (req, res) => {
  const prisma = getPrisma();
  await prisma.programRole.deleteMany({
    where: { programId: req.params.programId, userId: req.params.userId },
  });
  res.json({ message: 'Removed' });
}));

module.exports = router;
