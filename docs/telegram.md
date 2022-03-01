# Telegram 通知

Telegram 通知通过 Telegram bot 实现，你需要在控制面版中配置 `TG_BOT_TOKEN` 与 `TG_CHAT_ID`:

你需要通过通过 [@BotFather](https://t.me/BotFather) 创建机器人获取，并获取 API token。将这个 API token 设为 `TG_BOT_TOKEN`。

然后使用 [@userinfobot](https://t.me/userinfobot) 获取接受消息对象的 `chat_id`。接受消息的对象可以是用户，频道，或群组。将这个 id 填入 `TG_CHAT_ID`。
