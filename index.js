require('dotenv').config();
const { Client, GatewayIntentBits, Collection, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const moment = require('moment-timezone');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const timeData = new Map();

client.once('clientReady', () => {
    console.log(`勤怠管理ボット ${client.user.tag} がオンラインになりました！`);
    
    setInterval(() => {
        checkHourlyNotifications();
        checkDateChange();
    }, 60000);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    const args = message.content.trim().split(/ +/);
    const command = args[0].toLowerCase();
    
    switch (command) {
        case 't!':
            await handleHelpCommand(message);
            break;
        case 't!start':
            await handleStartCommand(message);
            break;
        case 't!break-start':
            await handleBreakStartCommand(message);
            break;
        case 't!break-end':
            await handleBreakEndCommand(message);
            break;
        case 't!end':
            await handleEndCommand(message);
            break;
        case 't!status':
            await handleStatusCommand(message);
            break;
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu()) return;
    
    if (interaction.customId === 'timekeeper_commands') {
        const command = interaction.values[0];
        
        // メッセージオブジェクトを作成（既存の関数と互換性を保つため）
        const mockMessage = {
            author: interaction.user,
            channel: interaction.channel,
            reply: async (content) => {
                await interaction.reply(content);
            }
        };
        
        switch (command) {
            case 'start':
                await handleStartCommand(mockMessage);
                break;
            case 'break-start':
                await handleBreakStartCommand(mockMessage);
                break;
            case 'break-end':
                await handleBreakEndCommand(mockMessage);
                break;
            case 'end':
                await handleEndCommand(mockMessage);
                break;
            case 'status':
                await handleStatusCommand(mockMessage);
                break;
        }
    }
});

async function handleStartCommand(message) {
    const userId = message.author.id;
    const now = moment().tz('Asia/Tokyo');
    
    if (timeData.has(userId) && timeData.get(userId).isWorking) {
        await message.reply('❌ 既に業務が開始されています。');
        return;
    }
    
    timeData.set(userId, {
        startTime: now,
        totalBreakTime: 0,
        isWorking: true,
        isOnBreak: false,
        breakStartTime: null,
        lastNotification: now,
        channelId: message.channel.id
    });
    
    await message.reply(`✅ 業務を開始しました！ (${now.format('YYYY/MM/DD HH:mm:ss')})`);
}

async function handleBreakStartCommand(message) {
    const userId = message.author.id;
    const userData = timeData.get(userId);
    
    if (!userData || !userData.isWorking) {
        await message.reply('❌ 業務が開始されていません。');
        return;
    }
    
    if (userData.isOnBreak) {
        await message.reply('❌ 既に休憩中です。');
        return;
    }
    
    const now = moment().tz('Asia/Tokyo');
    userData.isOnBreak = true;
    userData.breakStartTime = now;
    
    await message.reply(`🛑 休憩を開始しました。 (${now.format('HH:mm:ss')})`);
}

async function handleBreakEndCommand(message) {
    const userId = message.author.id;
    const userData = timeData.get(userId);
    
    if (!userData || !userData.isWorking) {
        await message.reply('❌ 業務が開始されていません。');
        return;
    }
    
    if (!userData.isOnBreak) {
        await message.reply('❌ 休憩中ではありません。');
        return;
    }
    
    const now = moment().tz('Asia/Tokyo');
    const breakDuration = now.diff(userData.breakStartTime, 'minutes');
    userData.totalBreakTime += breakDuration;
    userData.isOnBreak = false;
    userData.breakStartTime = null;
    
    await message.reply(`▶️ 休憩を終了しました。 (${now.format('HH:mm:ss')}) 休憩時間: ${Math.floor(breakDuration / 60)}時間${breakDuration % 60}分`);
}

async function handleEndCommand(message) {
    const userId = message.author.id;
    const userData = timeData.get(userId);
    
    if (!userData || !userData.isWorking) {
        await message.reply('❌ 業務が開始されていません。');
        return;
    }
    
    const now = moment().tz('Asia/Tokyo');
    const result = calculateWorkTime(userData, now);
    
    timeData.delete(userId);
    
    await message.reply(`🏁 業務を終了しました！\n📊 **勤務時間**: ${result.hours}時間${result.minutes}分\n⏱️ **休憩時間**: ${result.breakHours}時間${result.breakMinutes}分`);
}

async function handleStatusCommand(message) {
    const userId = message.author.id;
    const userData = timeData.get(userId);
    
    if (!userData || !userData.isWorking) {
        await message.reply('❌ 業務が開始されていません。');
        return;
    }
    
    const now = moment().tz('Asia/Tokyo');
    const result = calculateWorkTime(userData, now);
    
    const status = userData.isOnBreak ? '🛑 休憩中' : '▶️ 勤務中';
    
    await message.reply(`${status}\n📊 **現在の勤務時間**: ${result.hours}時間${result.minutes}分\n⏱️ **休憩時間**: ${result.breakHours}時間${result.breakMinutes}分`);
}

function calculateWorkTime(userData, currentTime) {
    let totalWorkMinutes = currentTime.diff(userData.startTime, 'minutes');
    
    let totalBreakTime = userData.totalBreakTime;
    if (userData.isOnBreak && userData.breakStartTime) {
        totalBreakTime += currentTime.diff(userData.breakStartTime, 'minutes');
    }
    
    totalWorkMinutes -= totalBreakTime;
    
    const hours = Math.floor(totalWorkMinutes / 60);
    const minutes = totalWorkMinutes % 60;
    const breakHours = Math.floor(totalBreakTime / 60);
    const breakMinutes = totalBreakTime % 60;
    
    return { hours, minutes, breakHours, breakMinutes };
}

async function checkHourlyNotifications() {
    const now = moment().tz('Asia/Tokyo');
    
    for (const [userId, userData] of timeData) {
        if (!userData.isWorking || userData.isOnBreak) continue;
        
        const minutesSinceLastNotification = now.diff(userData.lastNotification, 'minutes');
        
        if (minutesSinceLastNotification >= 60) {
            const result = calculateWorkTime(userData, now);
            const channel = client.channels.cache.get(userData.channelId);
            
            if (channel) {
                await channel.send(`⏰ <@${userId}> 1時間が経過しました！\n📊 **現在の勤務時間**: ${result.hours}時間${result.minutes}分`);
            }
            
            userData.lastNotification = now;
        }
    }
}

async function checkDateChange() {
    const now = moment().tz('Asia/Tokyo');
    
    if (now.hour() === 0 && now.minute() === 0) {
        for (const [userId, userData] of timeData) {
            if (!userData.isWorking) continue;
            
            const result = calculateWorkTime(userData, now);
            const channel = client.channels.cache.get(userData.channelId);
            
            if (channel) {
                await channel.send(`🌅 <@${userId}> 日付が変わりました。業務を自動終了します。\n📊 **勤務時間**: ${result.hours}時間${result.minutes}分\n⏱️ **休憩時間**: ${result.breakHours}時間${result.breakMinutes}分`);
            }
        }
        
        timeData.clear();
    }
}

async function handleHelpCommand(message) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('timekeeper_commands')
        .setPlaceholder('実行したいコマンドを選択してください')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('業務開始')
                .setDescription('勤怠記録を開始します')
                .setValue('start')
                .setEmoji('🟢'),
            new StringSelectMenuOptionBuilder()
                .setLabel('休憩開始')
                .setDescription('休憩時間の記録を開始します')
                .setValue('break-start')
                .setEmoji('☕'),
            new StringSelectMenuOptionBuilder()
                .setLabel('休憩終了')
                .setDescription('休憩時間の記録を終了します')
                .setValue('break-end')
                .setEmoji('🔄'),
            new StringSelectMenuOptionBuilder()
                .setLabel('業務終了')
                .setDescription('勤怠記録を終了し、結果を表示します')
                .setValue('end')
                .setEmoji('🔴'),
            new StringSelectMenuOptionBuilder()
                .setLabel('現在の状況')
                .setDescription('現在の勤務状況を確認します')
                .setValue('status')
                .setEmoji('📊')
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await message.reply({
        content: '📋 **勤怠管理ボット** - 実行したいコマンドを選択してください',
        components: [row]
    });
}

client.login(process.env.DISCORD_TOKEN);