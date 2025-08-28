require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    getVoiceConnection
} = require('@discordjs/voice');
const https = require('https');
const express = require('express');

// Load environment variables
const TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const MUSIC_URL = process.env.MUSIC_URL;

if (!TOKEN || !GUILD_ID || !CHANNEL_ID || !MUSIC_URL) {
    console.error("❌ Missing required environment variables!");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// --- Express server for Render ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('🎵 Discord Music Bot is running!'));
app.listen(PORT, () => console.log(`✅ HTTP server running on port ${PORT}`));

// --- Bot variables ---
let isPlaying = false;
let player;
let connection;

// --- Helper to check if users are in VC ---
function hasUsersInChannel() {
    const channel = client.channels.cache.get(CHANNEL_ID);
    return channel && channel.members.filter(m => !m.user.bot).size > 0;
}

// --- Helper to create stream (HTTPS) ---
function createStream(url) {
    return https.get(url, (res) => {
        if (res.statusCode !== 200) {
            console.error(`❌ Stream error: ${res.statusCode}`);
            return null;
        }
        return res;
    });
}

// --- Play music function ---
async function playMusic() {
    if (!hasUsersInChannel()) return;

    try {
        console.log(`▶️ Playing music from ${MUSIC_URL}`);
        const resource = createAudioResource(MUSIC_URL);
        player.play(resource);
    } catch (err) {
        console.error("❌ Error playing music:", err);
        setTimeout(() => {
            if (hasUsersInChannel()) playMusic();
        }, 5000);
    }
}

// --- Join VC and start music ---
function joinAndPlay() {
    const channel = client.channels.cache.get(CHANNEL_ID);
    if (!channel || !hasUsersInChannel()) {
        console.log('🚪 No users in VC, waiting...');
        return;
    }

    if (!connection || connection.state.status === 'destroyed') {
        connection = joinVoiceChannel({
            channelId: CHANNEL_ID,
            guildId: GUILD_ID,
            adapterCreator: client.guilds.cache.get(GUILD_ID).voiceAdapterCreator,
        });
    }

    if (!player) {
        player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Stop } });
        connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, () => {
            if (hasUsersInChannel()) {
                console.log('🔁 Music ended, restarting...');
                playMusic();
            } else {
                console.log('⏹️ No users left, stopping music.');
                stopAndDisconnect();
            }
        });

        player.on('error', (error) => {
            console.error(`⚠️ Player error: ${error.message}`);
            if (hasUsersInChannel()) setTimeout(playMusic, 5000);
        });
    }

    playMusic();
    isPlaying = true;
}

// --- Stop music and disconnect ---
function stopAndDisconnect() {
    if (player) player.stop();
    const conn = getVoiceConnection(GUILD_ID);
    if (conn) conn.destroy();
    isPlaying = false;
}

// --- Detect users joining/leaving VC ---
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const channel = client.channels.cache.get(CHANNEL_ID);
    if (!channel) return;

    // Stop if everyone leaves
    if (!hasUsersInChannel() && isPlaying) {
        console.log('🚪 Everyone left, stopping music...');
        stopAndDisconnect();
    }

    // Start music if users join
    if (hasUsersInChannel() && !isPlaying) {
        console.log('🎵 Users joined, starting music...');
        joinAndPlay();
    }
});

// --- Bot ready ---
client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    joinAndPlay(); // auto-start if users already in VC
});

// --- Login ---
client.login(TOKEN);
