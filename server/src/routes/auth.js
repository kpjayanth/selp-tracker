const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { getPrisma } = require('../db');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', asyncHandler(async (req, res) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid input' });
  const { email, password } = parse.data;
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status === 'INACTIVE') return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({
    token,
    user: { id: user.id, fullName: user.fullName, email: user.email, status: user.status },
  });
}));

router.get('/me', requireAuth, (req, res) => {
  const { id, fullName, email, status } = req.user;
  res.json({ id, fullName, email, status });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const parse = changePasswordSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid input' });
  const { currentPassword, newPassword } = parse.data;
  const ok = await bcrypt.compare(currentPassword, req.user.passwordHash);
  if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });
  const hash = await bcrypt.hash(newPassword, 12);
  const prisma = getPrisma();
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: hash } });
  res.json({ message: 'Password changed' });
}));

module.exports = router;
