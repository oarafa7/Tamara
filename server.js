const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const app = express();
const port = process.env.PORT || 3000;
const root = __dirname;

const dataDir = process.env.DATA_DIR || '/data';
const dataFile = path.join(dataDir, 'state.json');

const defaultState = {
  settings: {
    dailyLimit: 1000,
    rewardPerCalorie: 1,
    rewardCapEnabled: false,
    rewardCap: 10
  },
  meals: [],
  rewards: []
};

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(defaultState, null, 2), 'utf8');
  }
}

async function readState() {
  await ensureStore();
  const raw = await fs.readFile(dataFile, 'utf8');
  return JSON.parse(raw);
}

async function writeState(next) {
  await ensureStore();
  await fs.writeFile(dataFile, JSON.stringify(next, null, 2), 'utf8');
}

app.use(express.json({ limit: '5mb' }));
app.use(express.static(root, { extensions: ['html'] }));

app.get('/api/state', async (_req, res) => {
  try {
    const state = await readState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read state', detail: String(err.message || err) });
  }
});

app.put('/api/state', async (req, res) => {
  try {
    const next = req.body || {};
    if (!next.settings || !Array.isArray(next.meals) || !Array.isArray(next.rewards)) {
      return res.status(400).json({ error: 'Invalid state payload' });
    }
    await writeState(next);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save state', detail: String(err.message || err) });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(root, 'index.html'));
});

ensureStore().then(() => {
  app.listen(port, () => {
    console.log(`Pink Power Tracker running on port ${port}`);
    console.log(`State file: ${dataFile}`);
  });
});
