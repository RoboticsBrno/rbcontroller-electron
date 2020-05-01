// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const BROADCAST_PORT = 42424
const WEB_PORT = 9000
const DISCOVER_SLEEP = 0.2

var gServer = null;
var gDiscoverInterval = null;
var gDevices = {};
var gOwner = "";

function print(text)  {
    var log = document.getElementById("log");
    log.innerHTML = text + "\n" + log.innerHTML;
}

function addDevice(msg, rinfo) {
    if(msg["owner"] !== gOwner && gOwner !== "SuperRobotik")
        return;
    if(rinfo.address in gDevices)
        return;
    gDevices[rinfo.address] = true;

    var devices = document.getElementById("devices");
    var btn = document.createElement("button");
    btn.innerText = msg["name"]
    btn.style.margin = "8px";
    btn.style.padding = "8px";
    btn.style.fontSize = "1.5em";
    btn.addEventListener("click", () => {
        print("Connecting...")
        btn.disabled = true;
        clearInterval(gDiscoverInterval);
        gDiscoverInterval = null;
        gServer.close();

        var port = 80;
        var path = "/index.html";
        if("port" in msg)
            port = msg["port"];
        if("path" in msg)
            path = msg["path"];
        window.location = "http://" + rinfo.address + ":" + port + path;
    });
    devices.appendChild(btn);
}

function restartServer() {
    const dgram = require('dgram');
    if(gServer !== null) {
        gServer.close();
        gServer = null;
    }

    gServer = dgram.createSocket('udp4');

    gServer.on('error', (err) => {
        print(`server error:\n${err.stack}`);
        gServer.close();
    });

    gServer.on('message', (msg, rinfo) => {
        //print(`server got: ${msg} from ${rinfo.address}:${rinfo.port}`);
        var data = JSON.parse(msg);
        if(data && "c" in data && data["c"] == "found") {
            addDevice(data, rinfo);
        }
    });

    gServer.on('listening', () => {
        const address = gServer.address();
        print(`server listening ${address.address}:${address.port}`);

        gServer.setBroadcast(true)

        gDiscoverInterval = setInterval(() => {
            gServer.send('{"c":"discover"}', BROADCAST_PORT, "255.255.255.255");
        }, 100);
    });

    gServer.bind(BROADCAST_PORT);
}

function RBServer(dest_ip) {
    this.writeCounter = 0;
    this.readCounter = 0;
    this.destIp = dest_ip;

    const dgram = require('dgram');
    const WebSocket = require('ws');

    this.socket = dgram.createSocket('udp4');
    this.socket.on('error', (err) => {
        print(`server error:\n${err.stack}`);
    });

    this.socket.on('message', this.onSocketMessage.bind(this));

    this.socket.bind();

    this.server = new WebSocket.Server({
        port: WEB_PORT,
    });

    this.server.on('connection', function connection(conn) {
        conn.on('message', this.onWsMessage.bind(this));
    }.bind(this));
}

RBServer.prototype.send = function(msg) {
    msg["n"] = this.writeCounter++
    msg = JSON.stringify(msg)
    this.socket.send(msg, BROADCAST_PORT, this.destIp);
}

RBServer.prototype.onSocketMessage = function(msg) {
    msg = msg.toString().replace(/\n/g, "\\n");
    //console.log(msg)
    msg = JSON.parse(msg);
    if ("n" in msg) {
        var n = msg["n"]
        var diff = self.readCounter - n
        if(n !== -1 && diff > 0 && diff < 25)
            return;
        this.readCounter = n
    }

    msg = JSON.stringify(msg);

    this.server.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

RBServer.prototype.onWsMessage = function(msg) {
    //console.log(msg)
    this.send(JSON.parse(msg))
}

window.addEventListener('DOMContentLoaded', () => {
    var owner = document.getElementById("owner");
    if(owner) {
        gOwner = window.localStorage.getItem("owner")
        if(gOwner) {
            owner.value = gOwner;
        } else {
            gOwner = owner.value;
        }
        owner.addEventListener("input", () => {
            gOwner = owner.value;
            window.localStorage.setItem("owner", gOwner);
        });

        restartServer();
        print("Looking for robots...");
    } else {
        new RBServer(window.location.hostname);
    }
})
