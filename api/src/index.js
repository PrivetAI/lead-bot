const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./database/connection');
const telegramRouter = require('./telegram/routes');
const amocrmRouter = require('./amocrm/routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/telegram', telegramRouter);
app.use('/amocrm', amocrmRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.get('/conversation/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params;
    const result = await db.query(
      'SELECT * FROM conversations WHERE lead_id = $1 ORDER BY created_at DESC',
      [leadId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API server running on port ${PORT}`);
});