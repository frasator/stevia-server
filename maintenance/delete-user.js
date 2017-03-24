var args = process.argv.slice(2);
var deleteUser = require('./delete-user-module.js');
deleteUser(args,function(){
    console.log("DONE");
});
