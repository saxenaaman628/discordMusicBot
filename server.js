require('dotenv').config();
require('./bot/bot');  // This starts the bot automatically

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Discord Music Bot is running!'));

app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
