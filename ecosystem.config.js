module.exports = {
    apps: [
        {
            name: "discord",
            script: "./packages/discord/dist/bot.js"
        },
        {
            name: "web",
            script: "./packages/web/.output/server/index.mjs"
        },
    ]
}