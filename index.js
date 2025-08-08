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

client.once(Events.ClientReady, () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const channel = newState.guild.channels.cache.get(TARGET_CHANNEL_ID);

    // User joins target channel
    if (newState.channelId === TARGET_CHANNEL_ID && oldState.channelId !== TARGET_CHANNEL_ID) {
        const nonBotMembers = channel.members.filter(m => !m.user.bot);

        if (!isPlaying && nonBotMembers.size > 0) {
            console.log(`🎵 First user joined ${channel.name}, bot joining...`);
            isPlaying = true;

            const connection = joinVoiceChannel({
                channelId: TARGET_CHANNEL_ID,
                guildId: newState.guild.id,
                adapterCreator: newState.guild.voiceAdapterCreator,
            });

            try {
                const stream = await play.stream(MUSIC_URL);
                const resource = createAudioResource(stream.stream, { inputType: stream.type });
                const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Stop } });

                player.play(resource);
                connection.subscribe(player);

                player.on(AudioPlayerStatus.Idle, () => {
                    console.log('🎶 Song finished');
                });
            } catch (err) {
                console.error("❌ Error playing music:", err);
            }
        }
    }

    // User leaves target channel
    if (oldState.channelId === TARGET_CHANNEL_ID && newState.channelId !== TARGET_CHANNEL_ID) {
        const oldChannel = oldState.guild.channels.cache.get(TARGET_CHANNEL_ID);
        const remainingMembers = oldChannel.members.filter(m => !m.user.bot);

        if (remainingMembers.size === 0) {
            console.log('🚪 Everyone left, bot leaving...');
            const connection = getVoiceConnection(oldState.guild.id);
            if (connection) connection.destroy();
            isPlaying = false;
        }
    }
});

client.login(TOKEN);
