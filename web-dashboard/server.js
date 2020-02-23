const fs = require('fs');
const app = require('express')();
const favicon = require('serve-favicon')

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: true}));

const session = require('express-session');
const cookieParser = require('cookie-parser');
app.use(cookieParser());

const http = require('http').Server(app);
const io = require('socket.io')(http);

const db = require('./database');
const mp = require('multiparty');

app.set("view-engine", "ejs");

module.exports = (config, sm, ce) => {

    //This is probably a terrible idea, but ill fix it later
    app.use(session({
        secret: config.token,
        saveUninitialized: true,
        resave: true
    }))
    
    var port = process.env.PORT || config.port || 8080;
    
    app.use(favicon(__dirname + '/media/favicon.ico'));

    app.get('*', (req, res) => {
        
        if(req.session) {}

        if(req.path.indexOf('/p/') > -1) {
            if(!fs.existsSync(`${__dirname}/media/${req.path.split('/')[2]}`)) return res.render(page("404"),  {botName: config.name});
            return res.sendFile(media('/css/main-source.css'));
        }

        switch(req.path) {
            case "/":
                res.render(page("index"),  {botName: config.name});
            break;

            case "/about": 
                res.render(page("about"),  {botName: config.name});
            break;

            case "/stats": 
                res.render(page("stats"),  {botName: config.name, times: times, pingData: pings, guildData: guilds});
            break;

            case "/login":

                if(req.query.code) {

                    if(!req.query.code) return res.redirect("/login?e=Invalid Code");
                    var login = db.getLogin(req.query.code);
                    if(login == false) return res.redirect("/login?e=Invalid Code");

                    db.holdDelete(login.token);
                    res.render(page("dash"), {botName: config.name, serverData: getServersByToken(req.query.code), code: req.query.code});
                    
                } else {
                    var error = req.query.e || "";
                    res.render(page("login"),  {botName: config.name, botPrefix: config.prefix, error: error});
                }

            break;

            default: 
                res.render(page("404"),  {botName: config.name});
            break

            // case "/dash":
            //     res.render(page('dash'), {botName: config.name});
            // break

        }


    });

    app.post('*', (req, res) => {

        switch(req.path) {

            case "/login":

                if(!req.body.code) return res.redirect("/login?e=Invalid Code");
                var login = db.getLogin(req.body.code);
                if(login == false) return res.redirect("/login?e=Invalid Code");

                db.holdDelete(login.token);
                res.render(page("dash"), {botName: config.name, serverData: getServersByToken(req.body.code), code: req.body.code});
                //Store 

            break;

            case "/modify":
                var form = new mp.Form();

                form.parse(req, function(err, fields, files) {

                    var auth = fields.code;
                    var serverID = fields.server;
                    var server = false;

                    var serversFromToken = JSON.parse(getServersByToken(auth));

                    for(var i in serversFromToken) {
                        if(serversFromToken[i].id == serverID) server = serversFromToken[i];
                    }

                    if(server == false) return res.redirect('/login?e=No permission to edit that server');

                    var server = sm.getServerData(server.id);

                    var welcome = server.channels.find(c => c.name == fields.welcome_channel);
                    var modlog = server.channels.find(c => c.name == fields.modlog_channel);

                    server.welcome.channel = welcome ? welcome.id : server.welcome.channel;
                    server.modlog = modlog ? modlog.id : server.modlog;

                    if(files.welcome_icon.size <= 0 || files.welcome_icon[0].headers['content-type'].split('/')[0] != 'image') return res.redirect('/login?e=Invalid image file provided');
                    fs.copyFileSync(files.welcome_icon[0].path, `${__dirname}/media/images/${server.id}.${files.welcome_icon[0].headers['content-type'].split('/')[1]}`);

                    server.welcome.image = `${JSON.parse(fs.readFileSync(`${__dirname}/web-dashboard.json`))[1].address}/p/images/${server.id}.${files.welcome_icon[0].headers['content-type'].split('/')[1]}`;

                    sm.modifyServer(server.id, server);

                    res.redirect(`/login?code=${auth}`);

                });

                // res.redirect('/');

            break;

            default:
                res.redirect('404');
            break;

        }

    });


    http.listen(port, () => {
        info("Web Server Online!");
    });
    

    function page(pageName) {
        return `${__dirname}/pages/${pageName}.ejs`;
    }

    function media(mediaPath) {
        return `${__dirname}/media/${mediaPath}`;
    }

    var stats;
    var pings;
    var guilds;

    function refreshStats() {
        stats = JSON.parse(fs.readFileSync(`${__dirname}/stats.json`));
        
        times = stats._times;
        pings = stats.ping; 
        guilds = stats.guilds;

        while (times.length > 1000) {
            pings.shift();
            guilds.shift();
            times.shift();
        }

        io.emit('stats', [times, pings, guilds]);
    }

    setInterval(() => {refreshStats();}, 2500);
    refreshStats();

    function getServersByToken(token) {
        var login = db.getLogin(token);
        if(login == false) return "[]";
    
        var servers = sm.getServersByModUser(login.id);

        if(servers.length <= 0) return "[]";

        var serverData = [];

        for(var i in servers) {

            var server = servers[i];

            if(!server.name || !server.icon) continue;

            serverData.push({
                "name": server.name,
                "id": server.id,
                "icon": server.icon,
                "roles": server.roles,
                "channels": server.channels,
                "modlog": {channel: server.modlog ? server.modlog : false},
                "welcome": {channel: server.welcome.channel ? server.welcome.channel : false, banner: server.welcome.image ? server.welcome.image : false}
            })

        }

        return JSON.stringify(serverData);
    
    }

}
