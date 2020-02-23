var db = [{
    id: '205811939861856257',
    tag: 'tascord#9835',
    token: '11111111',
    held: false,
    heldInterval: false
  }];
var loggedIn = [];

module.exports = {

    createLogin: function(userID, userTag, token) {
        var userLogin = {id: userID, tag: userTag, token: token, held: false, heldInterval: false};
        db.push(userLogin);
    },

    getLogin: function(token) {
        
        for(var i in db) {
            if(db[i].token == token) return db[i];
        }

        return false;

    },

    deleteLogin: function(userID, token) {

        var login = this.getLogin(token);
        if(login == false) return;
        if(login.id != userID) return;

        var _db = [];

        for(var i in db) {
            if(db[i].id != userID) _db.push(db[i]);
        }

        db = _db;

    },

    holdDelete: function(token) {

        var login = this.getLogin(token);
        if(login == false) return;

        for(var i in db) {
            if(db[i].token == token) db[i].held = true;
            if(db[i].heldInterval != false) {
                clearTimeout(db[i].heldInterval);

                var token = db[i].token;

                db[i].heldInterval = setTimeout(() => { 

                    var login = this.getLogin(token)
                    if(login == false) return;
                    if(login.held == true) return;
                    
                    db.deleteLogin(message.author.id, token);

                }, 300000);

            } else {

                var token = db[i].token;

                db[i].heldInterval = setTimeout(() => { 

                    var login = this.getLogin(token);
                    if(login == false) return;
                    if(login.held == true) return;
                    
                    db.deleteLogin(message.author.id, token);

                }, 300000);

            }
            
        }
        
    }

}

// setInterval(() => {
//     console.log(db);
// }, 1000);