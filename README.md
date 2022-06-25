## Discord Account Onliner

This is an API that allows you to make your discord account online.

> **Note:** This is against the TOS of Discord.

### Get your Account token

Copy code to console Discord [Ctrl + Shift + I]

```js
window.webpackChunkdiscord_app.push([[Math.random()], {}, req => {
    for (const m of Object.keys(req.c).map(x => req.c[x].exports).filter(x => x)) {
      if (m.default && m.default.getToken !== undefined) return copy(m.default.getToken());
      if (m.getToken !== undefined) return copy(m.getToken());
    }
  }
]);

console.log('%cWorked!', 'font-size: 50px');
console.log(`%cYou now have your token in the clipboard!`, 'font-size: 16px');
```

### Star the project 🌟

If you like the project, please leave a star on the [GitHub repository](https://github.com/lazuee/discord-account-online).

### Support Server 💬

[Join the Discord server](https://discord.gg/He4UVdHmj5).
