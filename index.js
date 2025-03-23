const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, NoSubscriberBehavior, AudioPlayerStatus } = require('@discordjs/voice');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
// Initialize the bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// Constants
const AUDIO_CACHE = './cache'; // Directory for storing downloaded audio
const ROOM_ID = '1353227525609750620'; // Replace with the channel ID where the bot is allowed to operate

// Create cache directory if it doesn't exist
if (!fs.existsSync(AUDIO_CACHE)) fs.mkdirSync(AUDIO_CACHE);

// Variables for player and connection
let player; // Audio player instance
let currentConnection; // Current voice connection

// Bot ready event
client.once('ready', () => {
  console.log(`${client.user.tag} is now online and ready to play music!`);
});

// Message handler
client.on('messageCreate', async (message) => {
  if (message.author.bot) return; // Ignore bot messages

  // Restrict bot to a specific room
  if (message.channel.id !== ROOM_ID) return;

  // Regex to detect YouTube links
  const youtubeLinkRegex = /https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+|https?:\/\/youtu\.be\/[\w-]+/;
  const url = message.content.match(youtubeLinkRegex)?.[0]; // Extract YouTube link

  if (url) {
    // Ensure user is in a voice channel
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply('You need to join a voice channel to play music!');

    // Establish voice connection
    currentConnection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    const filePath = path.join(AUDIO_CACHE, `${Date.now()}_song.mp3`); // Generate unique file name

    // Download audio using yt-dlp
    exec(`yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${filePath}" ${url}`, (error, stdout, stderr) => {
      if (error) {
        console.error('Error downloading audio:', stderr);
        return message.reply('Failed to download the song. Please try another link!');
      }

      // Create and configure audio player
      player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
      });

      const resource = createAudioResource(filePath);
      player.play(resource);

      // Event listener for when the audio finishes
      player.on(AudioPlayerStatus.Idle, () => {
        console.log('Finished playing audio.');
        if (currentConnection) {
          currentConnection.destroy(); // Disconnect after playback
          currentConnection = null;
          fs.unlinkSync(filePath); // Clean up the audio file
        }
      });

      // Subscribe player to the voice connection
      currentConnection.subscribe(player);
      message.reply(`Now playing your song: ${url} 🎶`);
    });
  } else if (message.content.toLowerCase() === 'pause') {
    // Pause functionality
    if (player) {
      player.pause();
      message.reply('Music paused ⏸');
    } else {
      message.reply('No music is currently playing.');
    }
  } else if (message.content.toLowerCase() === 'resume') {
    // Resume functionality
    if (player) {
      player.unpause();
      message.reply('Music resumed ▶️');
    } else {
      message.reply('No music is currently paused.');
    }
  } else if (message.content.toLowerCase() === 'stop') {
    // Stop functionality
    if (currentConnection) {
      currentConnection.destroy(); // Disconnect from voice channel
      currentConnection = null;
      player = null;
      message.reply('Stopped playing and left the voice channel.');
    } else {
      message.reply('No music is playing currently.');
    }
  }
});

// Login to Discord using the bot token
client.login(process.env.DISCORD_TOKEN);