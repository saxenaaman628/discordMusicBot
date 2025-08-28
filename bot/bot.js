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
const { createStream } = require('./musicPlayer');

const TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const MUSIC_URL = process.env.MUSIC_URL;

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

let connection;
let player;
let isPlaying = false;

// Fetch channel safely
async function getChannel() {
    const guild = await client.guilds.fetch(GUILD_ID);
    return await guild.channels.fetch(CHANNEL_ID);
}

// Join VC and subscribe to player
async function joinAndPlay() {
    try {
        const channel = await getChannel();
        if (!channel) return console.error('Channel not found');

        connection = joinVoiceChannel({
            channelId: CHANNEL_ID,
            guildId: GUILD_ID,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Stop } });
        connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, async () => {
            const chan = await getChannel();
            const users = chan.members.filter(m => !m.user.bot).size;
            if (users > 0) {
                console.log('🔁 Music ended, restarting...');
                playMusic();
            } else {
                console.log('⏹️ No users left, stopping music.');
                stopAndDisconnect();
            }
        });

        player.on('error', (err) => {
            console.error('Player error:', err);
            setTimeout(async () => {
                const chan = await getChannel();
                if (chan.members.filter(m => !m.user.bot).size > 0) playMusic();
            }, 5000);
        });

        await playMusic();
        isPlaying = true;
    } catch (err) {
        console.error('Failed to join VC:', err);
    }
}

// Play music from URL
async function playMusic(url = MUSIC_URL) {
    if (!connection) return;
    try {
        console.log(`▶️ Playing music from ${url}`);
        const stream = await createStream(url);
        const resource = createAudioResource(stream);
        player.play(resource);
        isPlaying = true;
    } catch (err) {
        console.error('Error playing music:', err);
        setTimeout(async () => {
            const chan = await getChannel();
            if (chan.members.filter(m => !m.user.bot).size > 0 && connection) playMusic();
        }, 5000);
    }
}

// Stop and disconnect
function stopAndDisconnect() {
    if (player) player.stop();
    const conn = getVoiceConnection(GUILD_ID);
    if (conn) conn.destroy();
    isPlaying = false;
}

// Detect users joining/leaving VC
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const channel = await getChannel();
    const nonBotUsers = channel.members.filter(m => !m.user.bot).size;

    if (nonBotUsers > 0 && !isPlaying) {
        console.log('🎵 Users joined, bot will join and play');
        joinAndPlay();
    }

    if (nonBotUsers === 0 && isPlaying) {
        console.log('🚪 Everyone left, stopping music');
        stopAndDisconnect();
    }
});

// Login
client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
