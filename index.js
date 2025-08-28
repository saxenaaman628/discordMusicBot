require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    NoSubscriberBehavior, 
    getVoiceConnection,
    StreamType 
} = require('@discordjs/voice');
const ffmpeg = require('ffmpeg-static');
const { spawn } = require('child_process');

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

// Create a stream from MUSIC_URL using ffmpeg
function createStream(url) {
    return spawn(ffmpeg, [
        '-re',               // Read input at native frame rate
        '-i', url,           // Input URL
        '-f', 's16le',       // PCM 16-bit
        '-ar', '48000',      // 48kHz sample rate
        '-ac', '2',          // 2 channels (stereo)
        'pipe:1'             // Pipe to stdout
    ], { stdio: ['ignore', 'pipe', 'ignore'] }).stdout;
}

// Check if any non-bot users are in the VC
function hasUsersInChannel() {
    const channel = client.channels.cache.get(CHANNEL_ID);
    return channel && channel.members.filter(m => !m.user.bot).size > 0;
}

// Stop music and disconnect
function stopAndDisconnect() {
    if (player) player.stop();
    const conn = getVoiceConnection(GUILD_ID);
    if (conn) conn.destroy();
    isPlaying = false;
    console.log('⏹️ Music stopped, bot disconnected.');
}

// Play music
async function playMusic() {
    try {
        if (!connection) return;
        const stream = createStream(MUSIC_URL);
        const resource = createAudioResource(stream, { inputType: StreamType.Raw });
        player.play(resource);
        console.log('▶️ Music started!');

        resource.playStream.on('error', (err) => {
            console.error('❌ Stream error:', err);
            setTimeout(() => {
                if (hasUsersInChannel()) playMusic();
            }, 5000);
        });
    } catch (err) {
        console.error('❌ Error playing music:', err);
        setTimeout(() => {
            if (hasUsersInChannel()) playMusic();
        }, 5000);
    }
}

// Join VC and setup player
function joinAndPlay() {
    connection = joinVoiceChannel({
        channelId: CHANNEL_ID,
        guildId: GUILD_ID,
        adapterCreator: client.guilds.cache.get(GUILD_ID).voiceAdapterCreator,
    });

    player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Stop } });
    connection.subscribe(player);

    // Restart music when idle
    player.on(AudioPlayerStatus.Idle, () => {
        if (hasUsersInChannel()) {
            console.log('🔁 Music ended, restarting...');
            playMusic();
        } else {
            stopAndDisconnect();
        }
    });

    // Retry on player error
    player.on('error', (error) => {
        console.error('⚠️ Player error:', error.message);
        if (hasUsersInChannel()) setTimeout(playMusic, 5000);
    });

    playMusic();
    isPlaying = true;
}

// Detect user join/leave in VC
client.on(Events.VoiceStateUpdate, () => {
    if (!hasUsersInChannel() && isPlaying) {
        stopAndDisconnect();
    } else if (hasUsersInChannel() && !isPlaying) {
        console.log('🎵 Users joined, starting music...');
        joinAndPlay();
    }
});

// Keep bot alive and log in
client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    if (hasUsersInChannel()) joinAndPlay();
});

// Catch unhandled errors
process.on('unhandledRejection', console.error);

client.login(TOKEN);

// Keep Node process alive for Render free tier
process.stdin.resume();
