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
const play = require('play-dl');

const TOKEN = process.env.BOT_TOKEN;
const TARGET_CHANNEL_ID = process.env.VC_ID;
const MUSIC_URL = process.env.YOUTUBE_URL;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

let isPlaying = false;
let player; // Keep a single player instance
let connection;
let retryCount = 0

client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

async function playMusic() {
    try {
        console.log(`▶️ Starting music from ${MUSIC_URL}`);
        const stream = await play.stream(MUSIC_URL);
        const resource = createAudioResource(stream.stream, { inputType: stream.type });
        player.play(resource);
    } catch (err) {
        console.error("❌ Error playing music:", err);
        console.log("⏳ Retrying in 5 seconds...");
        setTimeout(playMusic, 5000); // Retry after 5 seconds if error
    }
}

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const channel = newState.guild.channels.cache.get(TARGET_CHANNEL_ID);

    // User joins target channel
    if (newState.channelId === TARGET_CHANNEL_ID && oldState.channelId !== TARGET_CHANNEL_ID) {
        const nonBotMembers = channel.members.filter(m => !m.user.bot);

        if (!isPlaying && nonBotMembers.size > 0) {
            console.log(`🎵 First user joined ${channel.name}, bot joining...`);
            isPlaying = true;

            connection = joinVoiceChannel({
                channelId: TARGET_CHANNEL_ID,
                guildId: newState.guild.id,
                adapterCreator: newState.guild.voiceAdapterCreator,
            });

            player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Stop } });
            connection.subscribe(player);

            // Song finished → replay
            player.on(AudioPlayerStatus.Idle, () => {
                console.log('🎶 Song finished, restarting...', retryCount);
                retryCount++
                playMusic();
            });

            // Error → retry
            player.on('error', error => {
                console.error(`⚠️ Player error: ${error.message}`, retryCount);
                retryCount++
                playMusic();
            });

            await playMusic();
        }
    }

    // User leaves target channel
    if (oldState.channelId === TARGET_CHANNEL_ID && newState.channelId !== TARGET_CHANNEL_ID) {
        const oldChannel = oldState.guild.channels.cache.get(TARGET_CHANNEL_ID);
        const remainingMembers = oldChannel.members.filter(m => !m.user.bot);

        if (remainingMembers.size === 0) {
            console.log('🚪 Everyone left, bot leaving...');
            if (connection) connection.destroy();
            isPlaying = false;
        }
    }
});

client.login(TOKEN);
