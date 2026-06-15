const router = require('express').Router();
const XLSX = require('xlsx');
const { getPrisma } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getProgramRole } = require('../middleware/rbac');
const { encryptParticipant, hmacToken } = require('../services/encryption');
const { getUpload } = require('../utils/upload');
const { log } = require('../services/audit');
const ah = require('../utils/asyncHandler');

const COL_MAP = {
  'First Name': 'firstName',
  'Last Name': 'lastName',
  'Who I am is the possibility of:': 'whoIAmPossibility',
  'My target community is:': 'targetCommunity',
  'The possibility of my project is:': 'projectPossibility',
  'My community project is:': 'projectDescription',
  'The name of my project is:': 'projectName',
  'The specific measurable results … by the end of the program are:': 'smrEndOfProgram',
  'MILESTONE by Workday 3 … results I will produce …': 'milestoneWorkday3',
  'MILESTONE by Workday 2 … results I will produce …': 'milestoneWorkday2',
  'Other resources I will contact to promote my project are:': 'promotionResources',
  'OTHER RESULTS: … people will register in the Landmark Forum:': 'forumRegistrations',
};

function parseSheet(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function normalizeRow(row) {
  const out = {};
  for (const [col, field] of Object.entries(COL_MAP)) {
    const key = Object.keys(row).find((k) => k === col || k.toLowerCase().trim() === col.toLowerCase().trim());
    out[field] = key ? String(row[key] || '').trim() : '';
  }
  return out;
}

router.post('/programs/:programId/import/preview', requireAuth, getUpload().single('file'), ah(async (req, res) => {
  const { programId } = req.params;
  const role = await getProgramRole(req.user.id, programId);
  if (!['LEADER', 'PROGRAM_COACH', 'HEAD_COACH'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const rows = parseSheet(req.file.buffer);
  const prisma = getPrisma();
  const existing = await prisma.participant.findMany({
    where: { programId, isDeleted: false },
    select: { id: true, firstNameToken: true, lastNameToken: true },
  });

  const preview = rows.map((rawRow) => {
    const row = normalizeRow(rawRow);
    if (!row.firstName && !row.lastName) return { status: 'SKIP', reason: 'Empty name', row };
    const fToken = hmacToken(row.firstName);
    const lToken = hmacToken(row.lastName);
    const match = existing.find((p) => p.firstNameToken === fToken && p.lastNameToken === lToken);
    return { status: match ? 'UPDATE' : 'CREATE', participantId: match?.id, row };
  });

  const summary = {
    total: preview.length,
    create: preview.filter((r) => r.status === 'CREATE').length,
    update: preview.filter((r) => r.status === 'UPDATE').length,
    skip: preview.filter((r) => r.status === 'SKIP').length,
  };
  res.json({ summary, rows: preview });
}));

router.post('/programs/:programId/import/commit', requireAuth, getUpload().single('file'), ah(async (req, res) => {
  const { programId } = req.params;
  const role = await getProgramRole(req.user.id, programId);
  if (!['LEADER', 'PROGRAM_COACH', 'HEAD_COACH'].includes(role)) return res.status(403).json({ error: 'Forbidden' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const groupId = req.body.groupId || null;
  const rows = parseSheet(req.file.buffer);
  const prisma = getPrisma();
  const existing = await prisma.participant.findMany({
    where: { programId, isDeleted: false },
    select: { id: true, firstNameToken: true, lastNameToken: true },
  });

  const results = { created: 0, updated: 0, skipped: 0, errors: [] };
  for (const rawRow of rows) {
    const row = normalizeRow(rawRow);
    if (!row.firstName && !row.lastName) { results.skipped++; continue; }
    const fToken = hmacToken(row.firstName);
    const lToken = hmacToken(row.lastName);
    const match = existing.find((p) => p.firstNameToken === fToken && p.lastNameToken === lToken);
    const projectData = {
      whoIAmPossibility: row.whoIAmPossibility || null, targetCommunity: row.targetCommunity || null,
      projectPossibility: row.projectPossibility || null, projectDescription: row.projectDescription || null,
      projectName: row.projectName || null, smrEndOfProgram: row.smrEndOfProgram || null,
      milestoneWorkday3: row.milestoneWorkday3 || null, milestoneWorkday2: row.milestoneWorkday2 || null,
      promotionResources: row.promotionResources || null, forumRegistrations: row.forumRegistrations || null,
    };
    try {
      if (match) {
        await prisma.communityProject.upsert({
          where: { participantId: match.id },
          create: { participantId: match.id, ...projectData },
          update: projectData,
        });
        results.updated++;
      } else {
        const enc = encryptParticipant({ firstName: row.firstName, lastName: row.lastName });
        const participant = await prisma.participant.create({ data: { ...enc, programId, groupId } });
        await prisma.communityProject.create({ data: { participantId: participant.id, ...projectData } });
        results.created++;
      }
    } catch (e) {
      results.errors.push({ name: `${row.firstName} ${row.lastName}`, error: e.message });
    }
  }
  await log({ actorUserId: req.user.id, action: 'IMPORT', entity: 'Program', entityId: programId, after: results });
  res.json(results);
}));

module.exports = router;
