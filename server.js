var express = require('express');
var socket = require('socket.io');
var app = express();
app.use("/", express.static(__dirname));

app.get("/", function(req, res)
{
	res.sendFile("index.html");
});

var server = app.listen(process.env.PORT || 3000, function () {
    console.log("server just started listening on port 3000 ....");

});

var io = socket(server);
io.set('transports', ['websocket']);

var tanks = {};
io.on("connection", function (socket) {
    console.log("A client tried to connect with ID :: " + socket.id);
    socket.emit("GetYourID", { id : socket.id });
    socket.on("ThankYou", function () {
        console.log("The client with ID " + socket.id + " Sent me a thankyou ");
    });
	
    socket.on("IWasCreated", function (data) {
        
        if (data.id != socket.id) { 
            // kick the cheater out;
        }
        tanks[data.id] = data;
        socket.broadcast.emit("AnotherTankCreated", data);
        
        for (key in tanks) {
            if (key == socket.id) continue;
            socket.emit("AnotherTankCreated", tanks[key]);
        }
    });
    
    socket.on("IMoved", function (data) {
        tanks[data.id] = data;
        socket.broadcast.emit("AnotherTankMoved", data);        
    });

    socket.on("IGoAway", function (data) {
        delete tanks[socket.id];
        socket.broadcast.emit("AnotherWentAway", { id : socket.id });
    });
    
    socket.on("ILaunchedBalloon", function (positionPrimitives) {
        socket.broadcast.emit("AnotherBalloonLaunched", positionPrimitives);        
    });

});

