const fs = require('fs');
const app = require('express')();
const favicon = require('serve-favicon')

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: true}));

const http = require('http').Server(app);
const io = require('socket.io')(http);

const db = require('./database');
const mp = require('multiparty');

app.set("view-engine", "ejs");

module.exports = (config, sm, ce) => {

    var port = process.env.PORT || config.port || 8080;
    
    app.use(favicon(__dirname + '/media/favicon.ico'));

    app.get('*', (req, res) => {
        
        if(req.path.indexOf('/p/') > -1) {
            if(!fs.existsSync(media(req.path.split('/').slice(2).join('/')))) return res.send('File not found');
            else return res.sendFile(media(req.path.split('/').slice(2).join('/')));
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

                    server.welcome.channel = (welcome ? welcome.id : server.welcome.channel);
                    server.modLog = (modlog ? modlog.id : server.modLog);

                    if(files.welcome_icon.size > 10) {
                        if(files.welcome_icon[0].headers['content-type'].split('/')[0] != 'image') return res.redirect('/login?e=Invalid image file provided');
                        fs.copyFileSync(files.welcome_icon[0].path, `${__dirname}/media/images/${server.id}.${files.welcome_icon[0].headers['content-type'].split('/')[1]}`);

                        server.welcome.image = `${JSON.parse(fs.readFileSync(`${__dirname}/web-dashboard.json`))[1].address}/p/images/${server.id}.${files.welcome_icon[0].headers['content-type'].split('/')[1]}`;
                    }

                    // var _server = sm.getServerData(server.id);
                    sm.modifyServer(server.id, server);

                    // sm.sendModMessage(ce.getClient(), server.id, `Web Dashbord Changed Some Settings\n\n\n**Welcome Channel**\n${_server.channels.find(c => c.id == _server.welcome.channel).name} ~> ${server.channels.find(c => c.id == server.welcome.channel).name}\n\n**Welcome Image**\n${server.welcome.image} ~> ${server.welcome.image}`)

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
                "modLog": {channel: server.modLog ? server.modLog : false},
                "welcome": {channel: server.welcome.channel ? server.welcome.channel : false, banner: server.welcome.image ? server.welcome.image : false}
            })

        }

        return JSON.stringify(serverData);
    
    }

}
