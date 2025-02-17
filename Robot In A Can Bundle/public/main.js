// Global variables for tab management and communication
let currentTab = null;
let tabSize = "fullscreen";
var snapframe = document.getElementById("snapframe"); // Reference to the iframe (or similar element) for communication with the ESP
var cbs = {}; // Object to store callbacks for message responses

// Accordion functionality for UI elements: toggle open/closed panels
document.querySelectorAll(".accordion-header").forEach(button => {
    button.addEventListener("click", function () {
        // Close all other accordion items
        document.querySelectorAll(".accordion-header").forEach(item => {
            if (item !== this) {
                item.classList.remove("active");
                item.nextElementSibling.style.display = "none";
            }
        });
        // Toggle this one: if open, close it; if closed, open it
        this.classList.toggle("active");
        let content = this.nextElementSibling;
        content.style.display = content.style.display === "block" ? "none" : "block";
    });
});

// Function to display a specific tab
function showTab(tabNum) {
    // If the requested tab is already open, hide it
    if (`tab${tabNum}` == currentTab && document.getElementById(currentTab).style.display == 'block'){
        document.getElementById(currentTab).style.display = "none";
        return;
    }
    // Hide currently open tab (if any)
    if (currentTab) {
        document.getElementById(currentTab).style.display = "none";
    }
    // Show the selected tab and update currentTab
    const tab = document.getElementById(`tab${tabNum}`);
    tab.style.display = "block";
    currentTab = `tab${tabNum}`;
    tab.classList.add("split-right");
}

// Function to toggle the size of the current tab (fullscreen, split, hidden)
function toggleTabSize() {
    if (!currentTab) {
        return;
    }
    const tab = document.getElementById(currentTab);
    if (tabSize === "fullscreen") {
        tab.classList.remove("split-right");
        tab.classList.add("split-left");
        tabSize = "split-left";
    } else if (tabSize === "split-left") {
        tab.classList.remove("split-left");
        tab.classList.add("split-right");
        tabSize = "split-right";
    } else if (tabSize === "split-right") {
        tab.style.display = "none";
        tabSize = "hidden";
    } else {
        tab.classList.remove("split-left", "split-right");
        tab.style.display = "block";
        tabSize = "fullscreen";
    }
}

// Function to send a message to the snapframe using the postMessage API
function send_msg(msg, cb) {
    // Generate a unique message ID for tracking the callback
    const messageId = Math.random().toString(36).substr(2, 9); 
    msg.id = messageId;

    // Store the callback function associated with this message ID
    cbs[messageId] = cb;
    // Post the message to the snapframe's content window (cross-origin communication)
    snapframe.contentWindow.postMessage(msg, "*");
}

// Listen for messages coming back from the snapframe
window.addEventListener("message", (event) => {
    if (event.data.cmd == 'chk'){
        // If the command is 'chk', call the chk function with the provided message
        chk(event.data.msg);
    }
    else if (!event.data || !event.data.id) {
        if (event.data && event.data.type === 'loadXML' && event.data.xmlURL) {
            sendXMLUrlToSnap(event.data.xmlURL);
        }
        // Ignore messages without an id property
        return;
    } else {
        // If we have a stored callback for this message ID, execute it
        if (typeof cbs[event.data.id] !== "undefined"){
            cbs[event.data.id](JSON.parse(JSON.stringify(event.data)));
            displayMessage(JSON.stringify(event.data));
            // Optionally, delete the callback if you only need it once:
            // delete cbs[event.data.id];
        }
    }   
});

// Function to display a message using the typewriter effect
function displayMessage(data) {
    queueTypeWriter(data);
}

// Update the UI with the given IP address and store it in local storage
function displayIP(ip) {
    document.getElementById("ip").innerHTML = ip;
    saveToLocalStorage("eBrain_ipaddress", ip);
}

// Update the UI with the robot name and store it in local storage
function displayRobot(name) {
    document.getElementById("robotName").innerHTML = name;
    saveToLocalStorage("eBrain_name", name);
}

// Get the current IP address displayed in the UI
function getDisplayIP() {
    return document.getElementById("ip").innerHTML;
}

// Request device information (IP and robot name) from the ESP
function getIpValue() {
    var message = {"cmd": "get_info"};
    // Send the command and update the UI when the response arrives
    send_msg(message, function(rtnMsg){
        displayIP(rtnMsg.ip);
        displayRobot(rtnMsg.name);
    });
}

// Simple delay function (using a fixed 6000ms delay)
function delay(callback) {
    setTimeout(callback, 6000); // 6000ms = 6 seconds
}

function waitForUSBConnection(timeout = 35000, interval = 300) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (isConnected()) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, interval);
  });
}

// Validate that a string is a valid IPv4 address
function isValidIP(ip) {
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|1?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|1?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|1?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|1?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
}

// Try connecting via WebSocket using the currently displayed IP
async function tryWebSocketConnection() {
    displayMessage("Valid IP found. Trying to connect via WebSocket...");
    await delayAS(2200);
    connectWS();
    await delayAS(6000);
    return isConnected();
}

// If WebSocket connection fails, prompt the user to connect via USB
async function promptUsbConnection() {
    displayMessage("Please connect via USB.");
    await delayAS(1200); 
    USBmsg();
    displayMessage("Click the button in SNAP -> Select 'USBSerial' from the pop-up");
    await delayAS(3400);
    displayMessage("Power cycle the eBrain if it doesn't appear.");
    let usbConnected = await waitForUSBConnection(36000, 500);
    return usbConnected;
}

async function checkExistingIP() {
  return new Promise((resolve, reject) => {
    // Send the get_info command; the callback receives the response (rtnMsg)
    send_msg({ cmd: "get_info" }, (rtnMsg) => {
      // Check if the response contains a valid IP
      if (rtnMsg && rtnMsg.ip) {
        displayIP(rtnMsg.ip);  // Update the UI with the IP
        resolve(rtnMsg.ip);
      } else {
        reject("No valid IP found");
      }
    });
  });
}

// If a saved SSID is available, try connecting to the saved network
async function attemptSavedNetworkConnection() {
    if(ssidPassSave  && ssidSave && isConnected()){
        displayMessage("Saved SSID detected. Attempting to connect to the saved network...");
        connectionWizard(); // Sends the set_wifi command using the saved SSID and password
        await delayAS(6000);
        getIpValue();       // Update the displayed IP from the device
        await delayAS(8000);
        if (isValidIP(getDisplayIP())) {
            displayMessage("Acquired valid IP. Trying WebSocket connection...");
            connectWS();
            await delayAS(6000);
            if (isConnected()) {
                displayMessage("Connected via WebSocket!");
                return true;
            } else {
                displayMessage("WebSocket connection failed after using saved credentials.");
                return false;
            }
        } else {
            displayMessage("Failed to acquire a valid IP from the saved network.");
            return false;
        }
    }
}

// Prompt the user to manually enter WiFi credentials
async function promptManualCredentials() {
    displayMessage("No saved network credentials found.");
    showWiFiPopup();
    await delayAS(13000);
    // At this point, your UI should allow the user to input credentials and trigger connectionWizard()
    // You could await a user event here if desired.
}

// The main connection wizard that sequences through the steps
async function connectAuto() {
    // Step 1: Check if a valid IP exists (from a previous session)
    if (isValidIP(getDisplayIP())) {
        // Attempt WebSocket connection using the existing IP
        let wsConnected = await tryWebSocketConnection();
        if (wsConnected) {
            return; // Successfully connected via WebSocket
        } else {
            // If WebSocket failed, prompt for USB connection
            let usbConnected = await promptUsbConnection();
            if (usbConnected) {
                if (ssidSave) {
                    await attemptSavedNetworkConnection();
                } else {
                    // Otherwise, prompt the user to manually enter their network details
                    displayMessage("Please enter WiFi credentials to connect eBrain to your network.");
                    await promptManualCredentials();
                }
            } else {
                displayMessage("USB not connected. Please ensure your eBrain is connected via USB.");
            }
        }
    } else {
        if(isConnected()){
            displayMessage("USB Connected - Trying to get IP...");
            const ip = await checkExistingIP();
            if(isValidIP(ip)){
                await delayAS(1200);
                // Try connecting via WebSocket using the acquired IP.
                connectWS();
            } else if (ssidSave) {
                // Step 3: If saved credentials exist, attempt to use them
                await attemptSavedNetworkConnection();
            } else {
                // Otherwise, prompt the user to manually enter their network details
                await promptManualCredentials();
            } 
        } else {
            // Step 2: No valid IP found – instruct the user to connect via USB
            displayMessage("No valid IP found. Connect your eBrain with a USB cable.");
            await delayAS(3000);
            let usbConnected = await promptUsbConnection();
            if (usbConnected) {
                const ip = await checkExistingIP();
                if(isValidIP(ip)){
                    await delayAS(1200);
                    // Try connecting via WebSocket using the acquired IP.
                    connectWS();

                } else if (ssidSave) {
                    // Step 3: If saved credentials exist, attempt to use them
                    await attemptSavedNetworkConnection();
                } else {
                    // Otherwise, prompt the user to manually enter their network details
                    await promptManualCredentials();
                }
            } else {
                displayMessage("USB connection failed. Unplug it and plug it back.");
            }
        }
        
    }
    
    // Final check after all attempts
    await delayAS(20000);
    if (!isConnected()) {
         displayMessage("Not Connected - See the Guidebook on How To Connect for more info.");
    }
}

function showWiFiPopup() {
  // Create the overlay that will dim the background and center the modal
  const overlay = document.createElement('div');
  overlay.id = 'wifiPopupOverlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.zIndex = '1000';

  // Create the modal container
  const modal = document.createElement('div');
  modal.id = 'wifiPopupModal';
  modal.style.backgroundColor = '#fff';
  modal.style.padding = '20px';
  modal.style.borderRadius = '5px';
  modal.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
  modal.style.width = '300px';
  modal.style.textAlign = 'center';

  // Insert your HTML into the modal
  modal.innerHTML = `
    <button id="wifichkButton" onclick="wifiCheck()">Scan WiFi</button>
    <br/><br/>
    <label for="ssid">SSID:</label>
    <input list="ssid" id="ssid-select-2" name="ssid-select" placeholder="Type or select">
    <datalist name="ssid" id="ssid-2">
    </datalist>
    <br/><br/>
    <label for="pass">PASS:</label>
    <input type="text" id="pass-2" name="pass">
    <br/><br/>
    <button id="wifiButton2" onclick="connectToRouterWithPopUp()">Connect To Router</button>
  `;

  // Append the modal to the overlay, then the overlay to the document body
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // When the Connect To Router button is clicked, close the pop-up
  document.getElementById('wifiButton2').addEventListener('click', function() {
    document.body.removeChild(overlay);
    // Optionally, you can call connectionWizard() or other functions here.
  });
}

// Function to send WiFi credentials to the ESP for connection
function connectionWizard() {
    if(ssidPassSave  && ssidSave && isConnected()){
        const ssid = ssidSave;
        const pass = ssidPassSave;
        var message = {"cmd": "set_wifi", "ssid": ssid , "pass": pass};
        // Send the set_wifi command; on success, update the displayed IP
        send_msg(message, function(rtnMsg){
            displayIP(rtnMsg.msg.sta_ip);
            connectWS();
        });
    }
}


// Function to send WiFi credentials to the ESP for connection
function connectToRouterWithGUI() {
    const ssid = document.getElementById("ssid-select").value;
    const pass = document.getElementById("pass").value;
    // Save the credentials in local storage
    saveToLocalStorage("eBrain_ssid", ssid);
    saveToLocalStorage("eBrain_pass", pass);
    var message = {"cmd": "set_wifi", "ssid": ssid , "pass": pass};
    // Send the set_wifi command; on success, update the displayed IP
    send_msg(message, function(rtnMsg){
        displayIP(rtnMsg.msg.sta_ip);
        connectWS();
    });
}

// Function to send WiFi credentials to the ESP for connection
function connectToRouterWithPopUp() {
    const ssid = document.getElementById("ssid-select-2").value;
    const pass = document.getElementById("pass-2").value;
    // Save the credentials in local storage
    saveToLocalStorage("eBrain_ssid", ssid);
    saveToLocalStorage("eBrain_pass", pass);
    var message = {"cmd": "set_wifi", "ssid": ssid , "pass": pass};
    // Send the set_wifi command; on success, update the displayed IP
    send_msg(message, function(rtnMsg){
        displayIP(rtnMsg.msg.sta_ip);
        connectWS();
    });
}

// Function to scan for available WiFi networks by sending a wifi_scan command
function wifiCheck() {
    send_msg({"cmd": "wifi_scan"}, function(rtnMsg){
        var wifi = "";
        if(typeof rtnMsg.ssids === "undefined"){
          return;
        }
        for(var i = 0; i < rtnMsg.ssids.length; i++) {
            wifi += "<option value ='" + rtnMsg.ssids[i] + "' >";
            wifi += rtnMsg.ssids[i];
            wifi += "</option>";
        }
        document.getElementById("ssid").innerHTML = wifi;
        if(document.getElementById("ssid-2")){
            document.getElementById("ssid-2").innerHTML = wifi;
        }
        
    });
}

// Connect to the ESP WebSocket server using the IP from the UI
function connectWS() {
    var url  = "ws://"+getDisplayIP()+":8899/websocket";
    displayMessage("...conecting: " + url);
    var msg = {'cmd':'url','msg':url};
    send_msg(msg,function(rtnMsg){});
}

// Function to close the WebSocket connection
function closeWS() {
    displayMessage("Closing Socket");
    var msg = {'cmd':'close'};
    send_msg(msg,function(rtnMsg){});
}

// Send a JSON command from the custom input field
function sendJsonText() {
    var jsonInput = document.getElementById("jsonInput").value;
    try {
        jsonInput = JSON.parse(jsonInput);
    } catch (e) {
        displayMessage(e);
    }
    send_msg(jsonInput,function(rtnMsg){});
}

// Send a USB command to the ESP (possibly to trigger serial communication)
function USBmsg(){
    const messageId = Math.random().toString(36).substr(2, 9); 
    var msg;
    msg = {'cmd':'usb','id':messageId};
    send_msg(msg,function(rtnMsg){});
}

// Close the USB connection
function closeSerial() {
    displayMessage("Closing USB");
    var msg = {'cmd':'closeUSB'};
    send_msg(msg,function(rtnMsg){});
}

// Update the connection indicator on the UI based on connection state
function chk(state){
    const btn = document.getElementById("connectedIndicator");
    const ip = document.getElementById("ip");
    const name = document.getElementById("robotName");
    if(state == true){
        displayMessage("eBrain Connected");
        btn.classList.add("connected");
        name.classList.add("connectedTXT");
        ip.classList.add("connectedTXT");
        btn.classList.remove("disconnected");
        name.classList.remove("disconnectedTXT");
        ip.classList.remove("disconnectedTXT");
    } else {
        displayMessage("eBrain Disconnected");
        btn.classList.add("disconnected");
        name.classList.add("disconnectedTXT");
        ip.classList.add("disconnectedTXT");
        btn.classList.remove("connected");
        name.classList.remove("connectedTXT");
        ip.classList.remove("connectedTXT");
    }
}

// Check if the device is considered connected (based on UI indicator)
function isConnected() {
    const element = document.getElementById("connectedIndicator");
    return element?.classList.contains("connected") || false;
}

// Utility functions for local storage
function saveToLocalStorage(key, value) {
    localStorage.setItem(key, value);
}
function getFromLocalStorage(key) {
    return localStorage.getItem(key);
}

// Retrieve saved connection info from local storage and update UI accordingly
let ipSave = getFromLocalStorage("eBrain_ipaddress");
let ssidSave = getFromLocalStorage("eBrain_ssid");
let ssidPassSave = getFromLocalStorage("eBrain_pass");
let nameSave = getFromLocalStorage("eBrain_name");

if (ipSave) {
    displayIP(ipSave);
} 
if (ssidSave) {
    var wifi = "";
    wifi += "<option value ='" + ssidSave + "' >";
    wifi += ssidSave;
    wifi += "</option>";
    document.getElementById("ssid").innerHTML = wifi;
} 
if (ssidPassSave) {
    document.getElementById("pass").value = ssidPassSave;
} 
if (nameSave) {
    displayRobot(nameSave);
}

// Allow elements (e.g., labels) to become editable on click for inline editing
function makeEditable(element) {
    // Store the original text in case the user cancels editing
    let originalText = element.innerText;

    // Make the element editable and focus it
    element.contentEditable = "true";
    element.focus();

    // Function to save changes when the user finishes editing (on blur or Enter)
    function saveChanges(event) {
        if (event.type === "blur" || (event.type === "keydown" && event.key === "Enter")) {
            element.contentEditable = "false";
            element.removeEventListener("blur", saveChanges);
            element.removeEventListener("keydown", saveChanges);
        }
    }

    // Add event listeners to save changes on blur or Enter key
    element.addEventListener("blur", saveChanges);
    element.addEventListener("keydown", saveChanges);
}

// Asynchronous delay function that returns a Promise (ms in milliseconds)
function delayAS(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Global promise chain for typewriter messages
let typewriterQueue = Promise.resolve();

// Queue a new message to be typed after previous messages have finished
function queueTypeWriter(text) {
  typewriterQueue = typewriterQueue.then(() => typeWriter(text));
  return typewriterQueue;
}

// Your typeWriter function remains unchanged:
async function typeWriter(text) {
  let outputElement = document.getElementById("output");
  text = text.toString();
  for (let index = 0; index < text.length; index++) {
    outputElement.innerHTML += text[index];
    await delayAS(30);
  }
  outputElement.innerHTML += '<br>';
  checkLines();
}

// Clear the output if there are too many lines
function checkLines() {
    const outputDiv = document.getElementById("output");
    // Count non-empty lines
    const lines = outputDiv.innerText.split("\n").filter(line => line.trim() !== "").length;
    // If lines exceed 9, clear the output
    if (lines > 9) {
        outputDiv.innerText = "";
    }
}

// Command definitions (with example values for demonstration)
const commands = {
  "version": {}, 
  "get_info": {},
  "wifi_status": {},
  "ws_status": {},
  "analog_read": {},
  "wifi_scan": {},
  "stop_motors": {},
  "set_wifi": { 
    "ssid": "example_ssid", 
    "pass": "example_pass" 
  },
  "get_info": {},
  "wifi_status": {},
  "ws_status": {},
  "digital_read": { 
    "pin": 13 
  },
  "analog_read": {},
  "digital_write": { 
    "pin": 13, 
    "value": "HIGH" 
  },
  "pwm_write": { 
    "pin": 13, 
    "value": 128 
  },
  "ultrasonic_distance": { 
    "trig_pin": 12, 
    "echo_pin": 14 
  },
  "dht11_read": { 
    "pin": 2 
  },
  "continuous_servo": { 
    "pin": 9, 
    "speed": 90 
  },
  "regular_servo": { 
    "pin": 10, 
    "angle": 45 
  },
  "move_servos": { 
    "servos": [
      { "mode": "continuous", "pin": 9, "speed": 90 },
      { "mode": "regular", "pin": 10, "angle": 45 }
    ]
  },
  "stepper_turn": { 
    "motor": 1, 
    "steps": 100, 
    "direction": 1 
  },
  "stepper_turn_multi": { 
    "motors": [
      { "motor": 0, "steps": 50, "direction": 1 },
      { "motor": 1, "steps": 50, "direction": 0 }
    ]
  },
  "update_settings": { 
    "version": 2, 
    "slackCalibration": 14, 
    "moveCalibration": 1.0, 
    "turnCalibration": 1.0, 
    "wheelDiameter": 70.0, 
    "wheelDistance": 150.0, 
    "wifi_ssid": "example_ssid", 
    "wifi_pass": "example_pass", 
    "robot_name": "eBrain" 
  },
  "wifi_scan": {},
  "beep": { 
    "pin": 8, 
    "frequency": 440, 
    "duration": 500 
  }
};

// Populate the command dropdown from the commands object
const selectElement = document.getElementById("commandSelect");
const argsContainer = document.getElementById("argInput");
const jsonInput = document.getElementById("jsonInput");

Object.keys(commands).forEach(cmd => {
    let option = document.createElement("option");
    option.value = cmd;
    option.textContent = cmd;
    selectElement.appendChild(option);
});

function generateJSON() {
    const selectedCommand = selectElement.value;
    const argsSchema = commands[selectedCommand];
    let jsonObject = { cmd: selectedCommand };

    if (argsSchema) {
        Object.keys(argsSchema).forEach(arg => {
            let inputField = document.getElementById(arg);
            if (inputField) {
                let value = inputField.value.trim();
                // If the schema default is an object, attempt to parse the input as JSON
                if (typeof argsSchema[arg] === "object") {
                    try {
                        jsonObject[arg] = JSON.parse(value);
                    } catch (e) {
                        // If parsing fails, you can either default to the raw value
                        // or alert the user. Here we'll just use the raw string.
                        jsonObject[arg] = value;
                    }
                } else {
                    // For primitive types, use the number conversion if expected
                    jsonObject[arg] = argsSchema[arg] === "number" ? parseFloat(value) || 0 : value;
                }
            }
        });
    }

    jsonInput.value = JSON.stringify(jsonObject, null, 2);
}
// Update the argument input fields based on the selected command's schema
function updateArgFields() {
    const selectedCommand = selectElement.value;
    const argsSchema = commands[selectedCommand];
    argsContainer.innerHTML = ""; // Clear previous argument fields

    if (argsSchema) {
        Object.keys(argsSchema).forEach(arg => {
            let label = document.createElement("label");
            label.textContent = arg + ": ";
            let input;
            // If the schema value is an array or object, use a textarea
            if (typeof argsSchema[arg] === "object") {
                input = document.createElement("textarea");
                input.rows = 4; // Adjust number of rows as needed
                input.value = JSON.stringify(argsSchema[arg], null, 2);
            } else {
                input = document.createElement("input");
                input.type = argsSchema[arg] === "number" ? "number" : "text";
                input.value = argsSchema[arg];
            }
            input.id = arg;
            input.addEventListener("input", generateJSON);

            argsContainer.appendChild(label);
            argsContainer.appendChild(input);
            argsContainer.appendChild(document.createElement("br"));
        });
    }

    generateJSON();
}

// When the selected command changes, update the argument fields accordingly
selectElement.addEventListener("change", updateArgFields);


function sendXMLUrlToSnap(xmlUrl) {
  if (snapframe && snapframe.contentWindow) {
    // Create a message object
    const message = {
      type: 'loadXML',
      xmlURL: xmlUrl
    };

    // Send the message. 
    // Replace '*' with the specific origin of the SNAP! iframe if known for better security.
    snapframe.contentWindow.postMessage(message, '*');
  } else {
    console.error('Snap iframe not found or inaccessible.');
  }
}

//sendXMLUrlToSnap(data.xmlURL);



