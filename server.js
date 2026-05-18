const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const Anthropic = require('@anthropic-ai/sdk');

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

app.post('/api/estimate', async (req, res) => {
  const { image } = req.body || {};
  if (!image || !image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'No valid image provided' });
  }

  const [header, base64Data] = image.split(',');
  const mediaType = header.replace('data:', '').replace(';base64', '');

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Data }
          },
          {
            type: 'text',
            text: 'Estimate the total calories in this food photo. Reply with only a single integer number, nothing else.'
          }
        ]
      }]
    });

    const text = response.content[0].text.trim();
    const calories = parseInt(text.replace(/\D/g, ''), 10);
    if (!Number.isFinite(calories) || calories <= 0) {
      return res.status(422).json({ error: 'Could not parse calorie estimate', raw: text });
    }
    return res.json({ calories });
  } catch (err) {
    return res.status(500).json({ error: 'Estimation failed', detail: String(err.message || err) });
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
