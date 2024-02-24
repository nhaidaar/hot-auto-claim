const { connect, keyStores, KeyPair } = require("near-api-js");
const { readFileSync } = require("fs");
const moment = require("moment");
const prompts = require("prompts");
const crypto = require("crypto");

// LOAD ENV
require('dotenv').config()
const token = process.env.TELEGRAM_BOT_TOKEN;
const userId = process.env.TELEGRAM_USER_ID;

// INIT TELEGRAM BOT
const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(token);

// CREATE DELAY IN MILLISECONDS
const delay = (timeInMinutes) => {
    return new Promise((resolve) => {
        return setTimeout(resolve, timeInMinutes * 60 * 1000);
    });
}

(async () => {
    // IMPORT LIST ACCOUNT
    const listAccounts = readFileSync("./private.txt", "utf-8")
        .split("\n")
        .map((a) => a.trim());

    // CHOOSE DELAY
    const chooseDelay = await prompts({
        type: 'select',
        name: 'time',
        message: 'Select time for each claim',
        choices: [
            {title: '2 hours', value: (2 * 60)},
            {title: '3 hours', value: (3 * 60)},
            {title: '4 hours', value: (4 * 60)},
        ],
    });

    // USE TELEGRAM BOT CONFIRMATION
    const botConfirm = await prompts({
        type: 'confirm',
        name: 'useTelegramBot',
        message: 'Use Telegram Bot as Notification?',
    });

    // CLAIMING PROCESS
    while (true) {
        for(const [index, value] of listAccounts.entries()) {
            const [PRIVATE_KEY, ACCOUNT_ID] = value.split("|");

            const myKeyStore = new keyStores.InMemoryKeyStore();
            const keyPair = KeyPair.fromString(PRIVATE_KEY);
            await myKeyStore.setKey("mainnet", ACCOUNT_ID, keyPair);

            const connection = await connect({
                networkId: "mainnet",
                nodeUrl: "https://rpc.mainnet.near.org",
                keyStore: myKeyStore,
            });

            const wallet = await connection.account(ACCOUNT_ID);

            console.log(
                `[${moment().format("HH:mm:ss")}] [${index + 1}/${
                    listAccounts.length
                }] Claiming ${ACCOUNT_ID}`
            );

            // CALL CONTRACT AND GET THE TX HASH
            const callContract = await wallet.functionCall({
                contractId: "game.hot.tg",
                methodName: "claim",
                args: {},
            });
            const hash = callContract.transaction.hash;

            // SEND NOTIFICATION BOT
            if (botConfirm.useTelegramBot) {
                try {
                    await bot.sendMessage(
                        userId, 
                        `Claimed HOT for ${ACCOUNT_ID}\nTx: https://nearblocks.io/id/txns/${hash}`,
                        { disable_web_page_preview: true }
                    );    
                } catch (error) {
                    console.log(`Send message failed, ${error}`)
                }
            }
        }

        // REDUCE REAL MINUTES WITH RANDOM
        const randomMinutes = crypto.randomInt(1, 9);
        const delayMinutes = chooseDelay.time - randomMinutes;

        console.log(`[ NEXT CLAIM IN ${moment().add(delayMinutes, 'minutes').format("HH:mm:ss")} ]`);
        await delay(delayMinutes);
    }

})();

