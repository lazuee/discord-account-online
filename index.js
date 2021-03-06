const Express = require("express");
const EventEmitter = require("events");
const Discord = require("discord.js-selfbot-v13");
const { Database } = require("quickmongo");
const mobile = { properties: { $browser: "Discord iOS" } };
const desktop = { properties: { $browser: "Discord Web" } };
const clean = (token = "") => token.split(".").map((val, i) => (i > 1 ? val = "*".repeat(10) : val)).join(".");
class Selfbot extends Discord.Client {
  constructor() {
    super({
      ws: [mobile, desktop].sort(() => 0.5 - Math.random())[0],
      readyStatus: false,
      presence: { status: "online" },
    });
  }

  login(token = "") {
    return new Promise((resolve, reject) => {
      this.once("ready", () => resolve(this));
      this.on("error", reject);
      super.login(token).catch(reject);
    });
  }
}

class Onliner extends EventEmitter {
  constructor() {
    super();

    /** @type Discord.Collection<string, Selfbot> */
    this.collection = new Discord.Collection();
    this.isReady = false;
    this.init();
      
    this.on("ready", () => {
      this.emit("log", `Uptime: ${process.uptime()}`);
      this.emit("reload");
      this.isReady = true;
    }).on("reload", async () => {
        try {
          if (!(await this.db.get("tokens"))) await this.db.set("tokens", []);
          let tokens = (await this.db.get("tokens")) ?? [];
          tokens = [...new Set(tokens)].filter((token) => token.length > 0);

          if (tokens.length === 0) {
            this.emit("log", "No tokens found");
            return;
          }
            
          const reload = false; //true - to reload the accounts
          if (reload && this.isReady && this.collection.size > 0) {
            this.emit("log", `\nReloading ${tokens.length} tokens`);

            this.collection.forEach((bot) => {
              bot.user?.setStatus("invisible");
              bot.destroy();
            });
            this.collection.clear();

            await new Promise((resolve) => setTimeout(resolve, 5000));
          }

          for (const token of tokens) {
            if (this.collection.has(token)) {
              //check if token is still valid
              const bot = this.collection.get(token);
              if (!bot.isReady) {
                this.emit("log", `Token ${clean(token)} is offline, renewing...`);
                this.collection.delete(token);
              } else {
                this.emit("log", `Token ${clean(token)} is online, skipping...`);
                continue;
              }
            }

            const bot = new Selfbot();
            bot
              .login(token)
              .then(() => {
                this.collection.set(token, bot);
                this.emit( "log", `Logged in as '${bot.user.tag}' with token: ${clean(token)}`);
              })
              .catch((error) => {
                this.emit("log", `Failed to login with token ${clean(token)}`);
                this.db.set("tokens", tokens.filter((t) => t !== token));
                this.collection.delete(token);
              });
          }
        } catch (error) {
          this.emit("log", error);
        }
      }).on("log", (message) => console.log(message));

    
    process.on("SIGINT", async () => {
        if (this.collection.size > 0) {
            this.emit("log", "\nRecieved SIGNT (Ctrl + C), gracefully destroy the accounts..");
            
            this.collection.forEach((bot) => {
              bot.user?.setStatus("invisible");
              bot.destroy();
            });
            this.collection.clear();
            
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        
        process.exit(0);
    });
  }

  async init() {
    const db = new Database(process.env?.MONGO_URI);
    db.on("ready", () => {
      this.db = db;
      this.emit("ready");
    });
    await db.connect();

    const app = Express();
    app.use(Express.urlencoded({ extended: true }));
    app.use(Express.json());
    app.set("port", process.env.PORT || 3000);
    app.set("case sensitive routing", true);
    app.set("strict routing", true);
    app.set("x-powered-by", false);
    app.set("trust proxy", true);
    app.set("json spaces", 2);
    app.set("etag", false);
    app
      .get("/", (req, res) => {
        const uptime = process.uptime();
        const dateString = this.dateString(uptime);
      
        res.json({
            status: "online",
            uptime: dateString,
            method: [
                "GET: /tokens - All tokens stored, you need to pass the auth token in the headers to get the data.",
                "POST: /tokens - Add your Discord token, it will stored the token then logged in to make your Online.",
                "DELETE: /tokens - Delete your Discord token, it will removed the token to the storage then logged off"
            ],
            online: [...this.collection.values()].map((bot) => `${bot.user.tag} (${bot.user.id})`)
        });
      })
      .get("/tokens", async (req, res) => {
        if (!req.headers.authorization) {
          res.status(401).json({
            error: "Unauthorized",
            message: "You must provide an authorization header",
          });
          return;
        }

        const auth = req.headers.authorization.split(" ");
        if (auth[0] !== "Bearer" || auth[1] !== process.env.AUTH_TOKEN) {
          res.status(401).json({
            error: "Unauthorized",
            message: "You must provide a valid authorization header",
          });
          return;
        }

        const data = (await this.db.get("tokens")) ?? [];
        res.json({ success: true, data });
      })
      .post("/tokens", async (req, res) => {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: "Missing token" });
        if (this.collection.has(token))
          return res.status(400).json({ error: "Token is already in use" });
        if ((await this.db.get("tokens")).includes(token))
          return res.status(400).json({ error: "Token is already in use" });
        await this.db.set("tokens", [...(await this.db.get("tokens")), token]);
        this.emit("log", `Added token ${clean(token)}`);
        this.emit("reload");
        res.json({ success: true });
      })
      .delete("/tokens", async (req, res) => {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: "Missing token" });
        if (!(await this.db.get("tokens")).includes(token))
          return res.status(400).json({ error: "Token is not in use" });
        await this.db.set(
          "tokens",
          (await this.db.get("tokens")).filter((t) => t !== token)
        );
        this.emit("log", `Removed token ${clean(token)}`);
        this.emit("reload");
        res.json({ success: true });
      });

    app.listen(process.env?.PORT, console.log(`Server started on port 3000`));
    this.app = app;
  }
  
  dateString(uptime) {
    const date = new Date(uptime * 1000);
    const days = date.getUTCDate() - 1,
          hours = date.getUTCHours(),
          minutes = date.getUTCMinutes(),
          seconds = date.getUTCSeconds(),
          milliseconds = date.getUTCMilliseconds();

    let segments = [];
    if (days > 0) segments.push(days + ' day' + ((days == 1) ? '' : 's'));
    if (hours > 0) segments.push(hours + ' hour' + ((hours == 1) ? '' : 's'));
    if (minutes > 0) segments.push(minutes + ' minute' + ((minutes == 1) ? '' : 's'));
    if (seconds > 0) segments.push(seconds + ' second' + ((seconds == 1) ? '' : 's'));
    //if (milliseconds > 0) segments.push(milliseconds + ' millisecond' + ((seconds == 1) ? '' : 's'));
    const dateString = segments.join(', ');
    
    return dateString;
  }
}

new Onliner();
