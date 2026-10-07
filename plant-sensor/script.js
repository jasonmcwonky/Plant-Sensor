// ==========================================
// PLANTSENSE
// Arduino + Simulation System
// ==========================================

// ------------------------------------------
// Current system state
// ------------------------------------------

let moisture = 68;
let pumpOn = false;

let automaticMode = true;
let moistureThreshold = 30;
let waterAmount = 10;

let wateringHistory = [];

// Arduino connection
let serialPort = null;
let serialReader = null;
let serialConnected = false;
let serialBuffer = "";


// ------------------------------------------
// Load saved settings
// ------------------------------------------

function loadSettings() {
    const savedThreshold =
        localStorage.getItem("moistureThreshold");

    const savedWaterAmount =
        localStorage.getItem("waterAmount");

    const savedMode =
        localStorage.getItem("automaticMode");

    if (savedThreshold !== null) {
        moistureThreshold = Number(savedThreshold);
    }

    if (savedWaterAmount !== null) {
        waterAmount = Number(savedWaterAmount);
    }

    if (savedMode !== null) {
        automaticMode = savedMode === "true";
    }
}


// ------------------------------------------
// Dashboard
// ------------------------------------------

function updateDashboard() {

    const moistureElement =
        document.getElementById("moistureValue");

    const moistureBar =
        document.getElementById("moistureBar");

    const pumpElement =
        document.getElementById("pumpStatus");

    const status =
        document.getElementById("plantStatus");

    const updatedElement =
        document.getElementById("lastUpdated");

    const thresholdElement =
        document.getElementById("dashboardThreshold");

    const waterAmountElement =
        document.getElementById("dashboardWaterAmount");


    // Soil moisture
    if (moistureElement) {
        moistureElement.textContent =
            moisture + "%";
    }


    // Moisture bar
    if (moistureBar) {
        moistureBar.style.width =
            Math.max(0, Math.min(100, moisture)) + "%";
    }


    // Pump
    if (pumpElement) {

        pumpElement.textContent =
            pumpOn ? "ON" : "OFF";

        pumpElement.style.color =
            pumpOn ? "#72d6a6" : "#9eada8";
    }


    // Plant status
    if (status) {

        if (moisture < moistureThreshold) {

            status.textContent =
                "⚠️ Soil is Dry";

            status.className =
                "status dry";

        } else if (moisture < 50) {

            status.textContent =
                "🟡 Soil is Getting Dry";

            status.className =
                "status dry";

        } else {

            status.textContent =
                "🟢 Healthy";

            status.className =
                "status healthy";
        }
    }


    // Threshold
    if (thresholdElement) {
        thresholdElement.textContent =
            moistureThreshold + "%";
    }


    // Water amount
    if (waterAmountElement) {
        waterAmountElement.textContent =
            waterAmount + "%";
    }


    // Last updated
    if (updatedElement) {

        updatedElement.textContent =
            "Last updated: " +
            new Date().toLocaleTimeString();
    }
}


// ------------------------------------------
// Water plant
// ------------------------------------------

function waterPlant() {

    if (pumpOn) {
        return;
    }


    // REAL ARDUINO
    if (serialConnected) {

        sendArduinoCommand(
            "PUMP:" + waterAmount
        );

        return;
    }


    // SIMULATION
    pumpOn = true;

    addWateringHistory();

    updateDashboard();


    setTimeout(() => {

        pumpOn = false;

        moisture = Math.min(
            moisture + waterAmount,
            100
        );

        updateDashboard();

    }, 3000);
}


// ------------------------------------------
// Automatic watering
// ------------------------------------------

function checkAutomaticWatering() {

    if (!automaticMode) {
        return;
    }

    // When the real Arduino is connected, IT decides when to water.
    if (serialConnected) {
        return;
    }


    if (
        moisture < moistureThreshold &&
        !pumpOn
    ) {

        waterPlant();
    }
}


// ------------------------------------------
// Watering history
// ------------------------------------------

function addWateringHistory() {

    const now = new Date();

    wateringHistory.unshift(
        now.toLocaleTimeString()
    );


    wateringHistory =
        wateringHistory.slice(0, 5);

    updateHistory();
}


function updateHistory() {

    const history =
        document.getElementById("history");

    if (!history) {
        return;
    }


    if (wateringHistory.length === 0) {

        history.innerHTML =
            "<p>No watering events yet.</p>";

        return;
    }


    history.innerHTML =
        wateringHistory
            .map(time =>
                `<p>💧 Watered at ${time}</p>`
            )
            .join("");
}


// ------------------------------------------
// Settings
// ------------------------------------------

function setupSettings() {

    // Moisture threshold

    const moistureButtons =
        document.querySelectorAll(
            ".moisture-option"
        );


    moistureButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                moistureThreshold =
                    Number(button.dataset.value);

                localStorage.setItem(
                    "moistureThreshold",
                    moistureThreshold
                );


                updateSettingsDisplay();
                updateDashboard();


                // Send new setting to Arduino
                if (serialConnected) {

                    sendArduinoCommand(
                        "THRESHOLD:" +
                        moistureThreshold
                    );
                }
            }
        );
    });


    // Water amount

    const waterButtons =
        document.querySelectorAll(
            ".water-option"
        );


    waterButtons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                waterAmount =
                    Number(button.dataset.value);

                localStorage.setItem(
                    "waterAmount",
                    waterAmount
                );


                updateSettingsDisplay();
                updateDashboard();


                if (serialConnected) {

                    sendArduinoCommand(
                        "WATER:" +
                        waterAmount
                    );
                }
            }
        );
    });


    // Automatic mode

    const automaticButton =
        document.getElementById(
            "automaticModeButton"
        );


    if (automaticButton) {

        automaticButton.addEventListener(
            "click",
            () => {

                automaticMode = true;

                localStorage.setItem(
                    "automaticMode",
                    "true"
                );


                updateSettingsDisplay();
                updateDashboard();


                if (serialConnected) {

                    sendArduinoCommand(
                        "MODE:AUTO"
                    );
                }
            }
        );
    }


    // Manual mode

    const manualButton =
        document.getElementById(
            "manualModeButton"
        );


    if (manualButton) {

        manualButton.addEventListener(
            "click",
            () => {

                automaticMode = false;

                localStorage.setItem(
                    "automaticMode",
                    "false"
                );


                updateSettingsDisplay();
                updateDashboard();


                if (serialConnected) {

                    sendArduinoCommand(
                        "MODE:MANUAL"
                    );
                }
            }
        );
    }
}


// ------------------------------------------
// Settings display
// ------------------------------------------

function updateSettingsDisplay() {

    const thresholdDisplay =
        document.getElementById(
            "thresholdDisplay"
        );

    const waterAmountDisplay =
        document.getElementById(
            "waterAmountDisplay"
        );

    const systemModeDisplay =
        document.getElementById(
            "systemModeDisplay"
        );

    const automaticButton =
        document.getElementById(
            "automaticModeButton"
        );

    const manualButton =
        document.getElementById(
            "manualModeButton"
        );


    if (thresholdDisplay) {

        thresholdDisplay.textContent =
            moistureThreshold + "%";
    }


    if (waterAmountDisplay) {

        waterAmountDisplay.textContent =
            waterAmount + "%";
    }


    if (systemModeDisplay) {

        systemModeDisplay.textContent =
            automaticMode
                ? "Automatic"
                : "Manual";
    }


    // Highlight moisture

    document
        .querySelectorAll(".moisture-option")
        .forEach(button => {

            button.classList.toggle(
                "selected",
                Number(button.dataset.value)
                === moistureThreshold
            );
        });


    // Highlight water amount

    document
        .querySelectorAll(".water-option")
        .forEach(button => {

            button.classList.toggle(
                "selected",
                Number(button.dataset.value)
                === waterAmount
            );
        });


    // Highlight mode

    if (automaticButton) {

        automaticButton.classList.toggle(
            "active",
            automaticMode
        );
    }


    if (manualButton) {

        manualButton.classList.toggle(
            "active",
            !automaticMode
        );
    }
}


// ==========================================
// ARDUINO SERIAL CONNECTION
// ==========================================

let socket = null;

// ------------------------------------------
// Auto-connect to server on every page load
// ------------------------------------------

function syncSettingsToArduino() {
    sendArduinoCommand("THRESHOLD:" + moistureThreshold);
    sendArduinoCommand("WATER:" + waterAmount);
    sendArduinoCommand(automaticMode ? "MODE:AUTO" : "MODE:MANUAL");
}

function connectArduino() {
    // Don't open a second socket if one is already alive
    if (socket && (socket.readyState === WebSocket.OPEN ||
                   socket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    socket = new WebSocket('ws://' + (location.host || 'localhost:3000'));

    socket.addEventListener('open', () => {
        console.log('🌐 Connected to server');
    });

    socket.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === 'status') {
            serialConnected = msg.connected;
            if (serialConnected) syncSettingsToArduino();
            updateArduinoStatus(serialConnected ? 'Connected' : 'Not connected');

            if (serialConnected) {
                console.log('%c✅ Arduino connected', 'color: green; font-weight: bold;');
            } else {
                console.warn('⚠️ Server has no live Arduino connection');
            }
        }

        if (msg.type === 'data') {
            processArduinoData(msg.line);
        }
    });

    socket.addEventListener('close', () => {
        serialConnected = false;
        socket = null;
        updateArduinoStatus('Lost connection to server');

        // Try to reconnect automatically after a short delay
        setTimeout(connectArduino, 2000);
    });

    socket.addEventListener('error', () => {
        updateArduinoStatus('Could not reach server');
    });
}

// Call this immediately when the page loads — no button needed
connectArduino();

function sendArduinoCommand(command) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(command);
    }
}

function processArduinoData(line) {

    if (!line) {
        return;
    }


    console.log(
        "Arduino:",
        line
    );


    // Example:
    // MOISTURE:62

    if (line.startsWith("MOISTURE:")) {

        const value =
            Number(
                line.substring(9)
            );


        if (!Number.isNaN(value)) {

            moisture =
                Math.max(
                    0,
                    Math.min(
                        100,
                        value
                    )
                );


            updateDashboard();
        }
    }


    // Example:
    // PUMP:ON

    if (line === "PUMP:ON") {

        pumpOn = true;

        updateDashboard();
    }


    // Example:
    // PUMP:OFF

    if (line === "PUMP:OFF") {

        pumpOn = false;

        addWateringHistory();

        updateDashboard();
    }
}


// ------------------------------------------
// Arduino status
// ------------------------------------------

function updateArduinoStatus(
    message
) {

    const status =
        document.getElementById(
            "arduinoStatus"
        );


    if (status) {

        status.textContent =
            message;
    }


    const messageElement =
        document.getElementById(
            "serialMessage"
        );


    if (messageElement) {

        messageElement.textContent =
            serialConnected
                ? "Arduino is connected and sending sensor data."
                : "Connect your Arduino to receive real soil-moisture readings.";
    }
}


// ------------------------------------------
// Connect buttons
// ------------------------------------------

function setupArduinoButton() {

    const button =
        document.getElementById(
            "connectArduinoButton"
        );


    if (button) {

        button.addEventListener(
            "click",
            connectArduino
        );
    }
}


// ==========================================
// SIMULATION
// ==========================================

function simulateSensors() {

    // Once Arduino is connected,
    // don't simulate sensor readings.

    if (serialConnected) {
        return;
    }


    if (!pumpOn) {

        moisture -= 1;

        moisture =
            Math.max(
                0,
                moisture
            );
    }


    updateDashboard();

    checkAutomaticWatering();
}


// ==========================================
// START
// ==========================================

loadSettings();

updateDashboard();

updateHistory();

updateSettingsDisplay();

setupSettings();

setupArduinoButton();


// Simulated sensor every 5 seconds

setInterval(
    simulateSensors,
    5000
);