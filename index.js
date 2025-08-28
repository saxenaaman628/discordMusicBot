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
const { PassThrough } = require('stream');

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
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

let isPlaying = false;
let player;
let connection;

// Helper: check if users exist in voice channel
function hasUsersInChannel() {
    const channel = client.channels.cache.get(CHANNEL_ID);
    return channel && channel.members.filter(m => !m.user.bot).size > 0;
}

// Helper: fetch remote MP3 stream
function createStream(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            if (res.statusCode === 200) {
                const passthrough = new PassThrough();
                res.pipe(passthrough);
                resolve(passthrough);
            } else {
                reject(new Error(`Failed to fetch stream: ${res.statusCode}`));
            }
        }).on('error', reject);
    });
}

// Play music function
async function playMusic() {
    try {
        console.log(`▶️ Playing music from ${MUSIC_URL}`);
        const stream = await createStream(MUSIC_URL);
        const resource = createAudioResource(stream);
        player.play(resource);
    } catch (err) {
        console.error("❌ Error playing music:", err);
        setTimeout(() => {
            if (connection && hasUsersInChannel()) playMusic();
        }, 5000);
    }
}

// Join VC and start music
function joinAndPlay() {
    connection = joinVoiceChannel({
        channelId: CHANNEL_ID,
        guildId: GUILD_ID,
        adapterCreator: client.guilds.cache.get(GUILD_ID).voiceAdapterCreator,
    });

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

    playMusic();
    isPlaying = true;
}

// Stop music and leave VC
function stopAndDisconnect() {
    if (player) player.stop();
    const conn = getVoiceConnection(GUILD_ID);
    if (conn) conn.destroy();
    isPlaying = false;
}

// Voice state updates: users join/leave
client.on(Events.VoiceStateUpdate, () => {
    if (!hasUsersInChannel() && isPlaying) {
        console.log('🚪 Everyone left, stopping music...');
        stopAndDisconnect();
    } else if (hasUsersInChannel() && !isPlaying) {
        console.log('🎵 Users joined, starting music...');
        joinAndPlay();
    }
});

// Ready
client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    if (hasUsersInChannel()) joinAndPlay();
});

// Login
client.login(TOKEN);

