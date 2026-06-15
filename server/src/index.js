require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRouter = require('./routes/auth');
const programsRouter = require('./routes/programs');
const groupsRouter = require('./routes/groups');
const participantsRouter = require('./routes/participants');
const projectsRouter = require('./routes/projects');
const searchRouter = require('./routes/search');
const importRouter = require('./routes/importRoute');
const auditRouter = require('./routes/audit');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json({ limit: '2mb' }));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true });
app.use('/api/auth', authLimiter);

// Serve uploaded photos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api', programsRouter);
app.use('/api', groupsRouter);
app.use('/api', participantsRouter);
app.use('/api', projectsRouter);
app.use('/api', searchRouter);
app.use('/api', importRouter);
app.use('/api', auditRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`SELP API running on :${PORT}`));
