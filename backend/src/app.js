require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes       = require('./routes/auth');
const parapheursRoutes = require('./routes/parapheurs');
const scansRoutes      = require('./routes/scans');
const adminRoutes       = require('./routes/admin');
const superviseurRoutes = require('./routes/superviseur');
const documentsRoutes   = require('./routes/documents');

const app = express();

// L'API est servie derrière nginx (un seul proxy) : on lit l'IP réelle du client
// dans X-Forwarded-For, sinon les limites de fréquence seraient communes à tous.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

app.use('/api/auth',       authRoutes);
app.use('/api/parapheurs', parapheursRoutes);
app.use('/api/scans',      scansRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/superviseur', superviseurRoutes);
app.use('/api/documents',   documentsRoutes);

app.get('/api/sante', (req, res) => {
  res.json({ statut: 'ok' });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route introuvable.' });
});

module.exports = app;