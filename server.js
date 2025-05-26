const express = require('express');
const fs = require('fs').promises;
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

const SLOTS_FILE = path.join(__dirname, 'slots.json');

const initializeSlotsFile = async () => {
  try {
    await fs.access(SLOTS_FILE);
  } catch {
    await fs.writeFile(SLOTS_FILE, JSON.stringify({}));
  }
};

initializeSlotsFile();

app.get('/api/slots', async (req, res) => {
  const { date } = req.query;
  const slotsData = JSON.parse(await fs.readFile(SLOTS_FILE, 'utf-8'));
  res.json(slotsData[date] || []);
});

app.post('/api/slots', async (req, res) => {
  const slot = req.body;
  const slotsData = JSON.parse(await fs.readFile(SLOTS_FILE, 'utf-8'));
  const date = slot.id.split('-').slice(0, 3).join('-');
  slotsData[date] = slotsData[date] || [];
  const existingIndex = slotsData[date].findIndex(s => s.id === slot.id);
  if (existingIndex >= 0) {
    slotsData[date][existingIndex] = slot;
  } else {
    slotsData[date].push(slot);
  }
  await fs.writeFile(SLOTS_FILE, JSON.stringify(slotsData, null, 2));
  res.json({ success: true });
});

app.post('/api/holiday', async (req, res) => {
  const { date, title } = req.body;
  const slotsData = JSON.parse(await fs.readFile(SLOTS_FILE, 'utf-8'));
  slotsData[date] = slotsData[date] || [];
  slotsData[date] = slotsData[date].map(slot => ({ ...slot, isHoliday: true, holidayTitle: title }));
  await fs.writeFile(SLOTS_FILE, JSON.stringify(slotsData, null, 2));
  res.json({ success: true });
});

app.listen(5000, () => console.log('Server running on http://localhost:5000'));