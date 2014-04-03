var net = require('net');
var config = require('./config.json');
var moment = require('moment');

var connections = {};
var shapes = {};
var current_id = 0;

function readShape(data) {
	var shape = {};
	var requested_id = data.readUInt32BE(2);
	shape.id = current_id++;
	shape.thickness = data[6]; 
	shape.color = [data[7], data[8], data[9], data[10]];
	var count = data.readUInt32BE(11);
	shape.points = [];
	for (var i = 0; i < count; i++) {
		var x = data.readInt32BE(15 + i*8);
		var y = data.readInt32BE(19 + i*8);
		shape.points[i].x = x;
		shape.points[i].y = y;
	}
	return shape;
};

function writeShape(buffer, shape, offset) {
	buffer.writeUInt8(shape.id, offset);
	buffer.writeUInt8(shape.thickness, offset + 4);
	buffer.writeUInt8(shape.color[0], offset + 5);
	buffer.writeUInt8(shape.color[1], offset + 6);
	buffer.writeUInt8(shape.color[2], offset + 7);
	buffer.writeUInt8(shape.color[3], offset + 8);
	
	var count = shape.points.length;
	buffer.writeUInt32BE(count, offset + 9);
	offset += 13;
	for (var i = 0; i < count; i++, offset += 8) {
		buffer.writeInt32BE(shape.points[i].x, offset);
		buffer.writeInt32BE(shape.points[i].x, offset + 4);
	} 
	return offset;
};

function sendShapes(socket) {
	var sendSize = 4; //Count is always included
	var count = 0;

	for (var key in shapes) {
		sendSize += 13 + shapes[key].points.length*8;
		count++;
	}

	var buffer = new Buffer(sendSize);
	var offset = 0;	
	buffer.writeUInt32BE(count, offset);
	offset += 4;

	for (var key in shapes) {
		offset += writeShape(buffer, shapes[key], offset);
	}
	socket.write(buffer);
};

function logError(string, ip) {
	console.error('[' + moment().format('YYYY-MM-DD HH:mm:ss') + ' - ' + ip + '] ' + string);
};

var server = net.createServer(function (socket) {
	socket.id = socket.remoteAddress + ':' + socket.remotePort;
	connections[socket.id] = socket;

	sendShapes(socket);

	socket.on('end', function() {
		delete connections[socket.id];
	});

	socket.on('data', function(data) {
		console.log(data);
		var version = data[0];
		var msg_type = data[1];

		switch (msg_type) {
			case 1: //New coordinates.
				var sid = data.readUInt32BE(2);
				if (shapes[sid] && shapes[sid].owner === this.id)  {
					var pts = shapes[sid].points;
					pts[pts.length].x = data.readUInt32BE(3);
					pts[pts.length].y = data.readUInt32BE(7);
				}
				break;
			case 2: //New shape.
				var shape = readShape(data);
				shape.owner = socket.id;
				shapes[shape.id] = shape;

				for (var key in connections) {
					var con = connections[key];
					if (con === this) continue;
					con.write(data);
				}
				break;
			case 4: //Delete shape.
				var sid = data.readUInt32BE(2);
				if (shapes[sid] && shapes[sid].owner === this.id) 
					delete shapes[sid];
				else
					logError('deletion of shape ' + sid + ' failed.', this.id);
				break;
			default:
				this.write('Unrecognized message type');
				logError('Unrecognized message type', this.id);
		}
	});
});

server.listen(config.port, config.server_ip);
console.log("Server established.\n");