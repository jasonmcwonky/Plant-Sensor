const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// Change COM4 to your Arduino's port (Arduino IDE > Tools > Port),
// or run:  set ARDUINO_PORT=COM5 && node server.js
const ARDUINO_PORT = process.env.ARDUINO_PORT || 'COM4';
const BAUD_RATE = 9600;

const app = express();
app.use(express.static(__dirname));
// Open http://localhost:3000 and get the dashboard directly
app.get('/', (req, res) =>
    res.sendFile(path.join(__dirname, 'sandraisgay(main web).html'))
);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let arduinoPort = null;
let arduinoConnected = false;
let lastDataTime = 0;
let retryTimer = null;

// ---------- helpers ----------
function broadcast(msg) {
    const data = JSON.stringify(msg);
    wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(data));
}

function setConnected(value) {
    if (arduinoConnected === value) return;
    arduinoConnected = value;
    console.log(value ? '✅ Arduino connected' : '⚠️ Arduino not connected');
    broadcast({ type: 'status', connected: arduinoConnected });
}

function scheduleReconnect() {
    if (retryTimer) return;               // only ever one retry pending
    retryTimer = setTimeout(() => {
        retryTimer = null;
        connectToArduino();
    }, 3000);
}

// ---------- serial ----------
async function connectToArduino() {
    const ports = await SerialPort.list();
    if (!ports.some(p => p.path === ARDUINO_PORT)) {
        console.error(`❌ ${ARDUINO_PORT} not found. Available:`,
            ports.map(p => p.path).join(', ') || '(none)');
        setConnected(false);
        scheduleReconnect();
        return;
    }

    arduinoPort = new SerialPort({ path: ARDUINO_PORT, baudRate: BAUD_RATE }, (err) => {
        if (err) {
            // Usually: Arduino IDE Serial Monitor is still open on this port
            console.error('❌ Could not open port:', err.message);
            setConnected(false);
            scheduleReconnect();
        }
    });

    const parser = arduinoPort.pipe(new ReadlineParser({ delimiter: '\n' }));

    parser.on('data', (line) => {
        line = line.trim();
        if (!line) return;
        lastDataTime = Date.now();
        setConnected(true);               // first line = board is alive
        broadcast({ type: 'data', line });
    });

    arduinoPort.on('close', () => {
        setConnected(false);
        scheduleReconnect();
    });

    arduinoPort.on('error', (err) => {
        console.error('Serial error:', err.message);
        setConnected(false);
    });
}

// If the board stops talking for 5s, mark it disconnected
setInterval(() => {
    if (arduinoConnected && Date.now() - lastDataTime > 5000) {
        setConnected(false);
    }
}, 2000);

// ---------- websocket (browser <-> server) ----------
const ALLOWED = /^(PUMP|THRESHOLD|WATER):\d{1,3}$|^MODE:(AUTO|MANUAL)$/;

wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'status', connected: arduinoConnected }));

    ws.on('message', (msg) => {
        const command = msg.toString().trim();
        if (!ALLOWED.test(command)) {
            console.warn('Rejected unknown command:', command);
            return;
        }
        if (arduinoConnected && arduinoPort && arduinoPort.isOpen) {
            arduinoPort.write(command + '\n');
        } else {
            console.warn('Ignored command, Arduino not connected:', command);
        }
    });
});

connectToArduino();
server.listen(3000, () => console.log('Server running on http://localhost:3000'));