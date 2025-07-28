require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const moment = require('moment-timezone');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const timeData = new Map();

client.once('ready', () => {
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
        case '/start':
            await handleStartCommand(message);
            break;
        case '/break-start':
            await handleBreakStartCommand(message);
            break;
        case '/break-end':
            await handleBreakEndCommand(message);
            break;
        case '/end':
            await handleEndCommand(message);
            break;
        case '/status':
            await handleStatusCommand(message);
            break;
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

client.login(process.env.DISCORD_TOKEN);