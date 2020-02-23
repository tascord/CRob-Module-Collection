const Discord = require('discord.js');
const db = require('./database');

var config = {};

module.exports = {

    load: function(_config) {
        config = _config;

        if(!config.address) {
            console.log(config);
            console.log("\nPlease add a config.address to use this extention.");
            process.exit(1);
        }

    },
    reload: function() {},

    trigger: function(message, command, args) {

        var token = getCode();
        while(db.getLogin(token) != false) {
            token = getCode();
        }

        const embed = new Discord.RichEmbed()
            .setColor(config.colour)
            .setTitle("Secure Login Token [Click Me To Login]")
            .setURL(`${config.address}/login`)
            .setDescription(`Your code is '${token}'\n\nThis code will expire in 10 minutes.\nPlease DO NOT share this code with anyone, it will allow them to modify the bot's settings relating to your servers.`);

        db.createLogin(message.author.id, message.author.tag, token);
        
        setTimeout(() => { 
            
            var login = db.getLogin(token);
            if(login == false) return;
            if(login.held == true) return;
            
            db.deleteLogin(message.author.id, token);
        }, 600000)

        message.author.send({ embed });

    }

}

function getCode(length, alphabet) {

    if(!alphabet) var alphabet = "abcdefghijklmnopqrstuvwzyxABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    if(!length) var length = 8;

    var output = "";

    for(var i = 0; i < length; i++) {
        output += alphabet[Math.floor(Math.random() * Math.floor(alphabet.length))];
    }

    return output;

}