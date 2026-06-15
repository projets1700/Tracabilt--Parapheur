require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes       = require('./routes/auth');
const parapheursRoutes = require('./routes/parapheurs');
const evenementsRoutes = require('./routes/evenements');
const utilisateursRoutes = require('./routes/utilisateurs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth',         authRoutes);
app.use('/api/parapheurs',   parapheursRoutes);
app.use('/api/evenements',   evenementsRoutes);
app.use('/api/utilisateurs', utilisateursRoutes);

app.get('/api/sante', (req, res) => {
  res.json({ statut: 'ok', message: 'Serveur TraçaParapheur opérationnel', version: '1.0.0' });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route introuvable.' });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});