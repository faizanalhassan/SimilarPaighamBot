const client = require('socket.io-client')('ws://localhost:3210');
client.on('connect', function(){console.log(['connected', arguments])});
client.on('end', function(data){console.log(['end', arguments]); client.close();});
client.on("message", function () {console.log('message', arguments)});
client.on('disconnect', function(){console.log(['disconnected', arguments]); client.close();});
// client.send({successCount: 0, failedCount: 0});
// client.emit('end');
exports.client = client;