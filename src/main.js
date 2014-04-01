var net = require('net');
var config = require('./config.json');

var connections = {};
var shapes = {};
var current_id = 0;

var createShape = function(data) {
	var shape = {};
	shape.id = current_id++;
	shape.thickness = data[2]; 
	shape.color = (data[3], data[4], data[5], data[6]);
	var count = data.readUInt32BE(7);
	shape.points = [];
	for (var i = 0; i < count; i++) {
		var x = data.readInt32BE(11 + i*8);
		var y = data.readInt32BE(15 + i*8);
		shape.points[i] = (x, y);
	}
	return shape;
};

var server = net.createServer(function (socket) {
	socket.write('Welcome bitch!\r\n');
	socket.id = socket.remoteAddress + ':' + socket.remotePort;
	connections[socket.id] = socket;

	socket.on('end', function() {
		delete connections[socket.id];
	});

	socket.on('data', function(data) {
		console.log(data);
		var version = data[0];
		var msg_type = data[1];

		switch (msg_type) {
			case 2: //New shape.
				var shape = createShape(data);
				shapes[shape.id] = shape;

				for (var key in connections) {
					var con = connections[key];
					if (con === this) continue;
					con.write(data);
				}

				break;
			default:
				this.write('Unrecognized message type');

		}
	});
});

server.listen(config.port, config.server_ip);
console.log("Server established.\n");