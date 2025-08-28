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

// Load environment variables
const TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const MUSIC_URL = process.env.MUSIC_URL;

if (!TOKEN || !GUILD_ID || !CHANNEL_ID || !MUSIC_URL) {
    console.error("❌ Missing required environment variables in .env file!");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

let isPlaying = false;
let player;
let connection;

client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

function createStream(url) {
    return https.get(url, (res) => {
        if (res.statusCode !== 200) {
            console.error(`❌ Stream error: ${res.statusCode}`);
            return null;
        }
        return res;
    });
}

async function playMusic() {
    try {
        console.log(`▶️ Playing music from ${MUSIC_URL}`);
        const stream = createStream(MUSIC_URL);

        if (!stream) {
            console.log("⏳ Stream not available, retrying in 5 seconds...");
            setTimeout(() => {
                if (connection && hasUsersInChannel()) playMusic();
            }, 5000);
            return;
        }

        const resource = createAudioResource(MUSIC_URL);
        player.play(resource);
    } catch (err) {
        console.error("❌ Error playing music:", err);
        setTimeout(() => {
            if (connection && hasUsersInChannel()) playMusic();
        }, 5000);
    }
}

function hasUsersInChannel() {
    const channel = client.channels.cache.get(CHANNEL_ID);
    return channel && channel.members.filter(m => !m.user.bot).size > 0;
}

function joinAndPlay() {
    connection = joinVoiceChannel({
        channelId: CHANNEL_ID,
        guildId: GUILD_ID,
        adapterCreator: client.guilds.cache.get(GUILD_ID).voiceAdapterCreator,
    });

    player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Stop } });
    connection.subscribe(player);

    // Restart if idle
    player.on(AudioPlayerStatus.Idle, () => {
        if (hasUsersInChannel()) {
            console.log('🎶 Stream ended, restarting...');
            playMusic();
        } else {
            console.log('⏹️ No users left, stopping music.');
            stopAndDisconnect();
        }
    });

    // Retry on error
    player.on('error', (error) => {
        console.error(`⚠️ Player error: ${error.message}`);
        if (hasUsersInChannel()) setTimeout(playMusic, 5000);
    });

    playMusic();
    isPlaying = true;
}

function stopAndDisconnect() {
    if (player) player.stop();
    const conn = getVoiceConnection(GUILD_ID);
    if (conn) conn.destroy();
    isPlaying = false;
}

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const channel = client.channels.cache.get(CHANNEL_ID);
    if (!channel) return;

    if (!hasUsersInChannel() && isPlaying) {
        console.log('🚪 Everyone left, stopping music...');
        stopAndDisconnect();
    }

    if (hasUsersInChannel() && !isPlaying) {
        console.log('🎵 Users joined, starting music...');
        joinAndPlay();
    }
});

client.login(TOKEN);
