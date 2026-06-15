require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes        = require('./routes/auth');
const parapheursRoutes  = require('./routes/parapheurs');
const evenementsRoutes  = require('./routes/evenements');
const utilisateursRoutes = require('./routes/utilisateurs');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth',         authRoutes);
app.use('/api/parapheurs',   parapheursRoutes);
app.use('/api/evenements',   evenementsRoutes);
app.use('/api/utilisateurs', utilisateursRoutes);

app.get('/api/sante', (req, res) => {
  res.json({ statut: 'ok' });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route introuvable.' });
});

module.exports = app;