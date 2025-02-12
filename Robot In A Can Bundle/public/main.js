let currentTab = null;
let tabSize = "fullscreen";
var snapframe = document.getElementById("snapframe");
var cbs = {};




document.querySelectorAll(".accordion-header").forEach(button => {
    button.addEventListener("click", function () {
        // Close all other accordion items
        document.querySelectorAll(".accordion-header").forEach(item => {
            if (item !== this) {
                item.classList.remove("active");
                item.nextElementSibling.style.display = "none";
            }
        });

        // Toggle this one
        this.classList.toggle("active");
        let content = this.nextElementSibling;
        content.style.display = content.style.display === "block" ? "none" : "block";
    });
});

function showTab(tabNum) {
    if (`tab${tabNum}` == currentTab && document.getElementById(currentTab).style.display == 'block'){
        document.getElementById(currentTab).style.display = "none";
        return;
    }
    if (currentTab) {
        document.getElementById(currentTab).style.display = "none";
    }
    const tab = document.getElementById(`tab${tabNum}`);
    tab.style.display = "block";
    currentTab = `tab${tabNum}`;
    tab.classList.add("split-right");
}

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




function send_msg(msg,cb){
    const messageId = Math.random().toString(36).substr(2, 9); 
    msg.id = messageId;

    // Store the callback function
    cbs[messageId] = cb;
    snapframe.contentWindow.postMessage(msg, "*");
}


window.addEventListener("message", (event) => {
    if (event.data.cmd == 'chk'){
        chk(event.data.msg);
    }
    else if (!event.data || !event.data.id) {
        return;
    } else {
        if (typeof cbs[event.data.id] !== "undefined"){
            cbs[event.data.id](JSON.parse(JSON.stringify(event.data)));
            displayMessage(JSON.stringify(event.data));
            //delete cbs[event.data.id]; // Clean up
        }
    }   
});



function displayMessage(data) {
    typeWriter(data);
}

function displayIP(ip) {
    document.getElementById("ip").innerHTML = ip;
    saveToLocalStorage("eBrain_ipaddress", ip);
}

function displayRobot(name) {
    document.getElementById("robotName").innerHTML = name;
    saveToLocalStorage("eBrain_name", name);
}


function getDisplayIP() {
    return document.getElementById("ip").innerHTML;
}

function getIpValue() {
    var message = {"cmd": "getConfig"};
    //JSON Command, Function to do on successful completion (where rtnMsg is the returned message of the complete command)
    send_msg(message, function(rtnMsg){
        displayIP(rtnMsg.msg.sta_ip);
        displayRobot(rtnMsg.msg.ap_ssid);
    });
}






function delay(callback) {
    setTimeout(callback, 6000); // 1000ms = 1 second
}

function isValidIP(ip) {
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|1?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|1?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|1?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|1?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
}



async function connectAuto() {
    //We have valid IP we were probably connected before let's try websocket
    if(isValidIP(getDisplayIP())){
        connectWS();
        await delayAS(6000);
        //if not connected try usb
        if(!isConnected()){
            displayMessage("Connecting over WiFi didn't work. Trying to connect via USB...");
            await delayAS(3000);
            displayMessage("Connect your eBrain with a cable to your USB port");
            await delayAS(3000);
            USBmsg();
            displayMessage("Click the button on the SNAP environment to see the USB devices");  
            await delayAS(7000);
            displayMessage("Select the option 'USB Serial' or RobotInACan");
            await delayAS(8000);
            if (isConnected()) {
                displayMessage("Enter WiFi SSID (your WiFi network name) and Password below!");
                await delayAS(3000);
                displayMessage("You can Scan for WiFi networks, then select yours");
                await delayAS(3000);
                displayMessage("Enter your WiFi password, then press 'Connect To Router'");
                await delayAS(3000);
                displayMessage("Then once you have an IP address you can connect Wireless!");
            } else {
                displayMessage("Not Connected - See the Guidebook on How To Connect for more info");
            }
        } else{
            displayMessage("websocket Connected!");
        }

    } else {
        //no IP address or previous connection info so let's get it over usb
        displayMessage("Connect your eBrain with a cable to your USB port");
        await delayAS(3000);
        USBmsg();
        displayMessage("Click the button on the SNAP environment");
        await delayAS(6000);
        displayMessage("Select the option 'USB Serial' or RobotInACan");
        await delayAS(15000);
        //if we have network info saved use it to try to connect eBrain to network
        if(ssidSave && isConnected()){
            displayMessage("SSID detected -- Trying to connect to saved network...");
            connectionWizard();
            await delayAS(6000);
            getIpValue();
            await delayAS(8000);
            if(isValidIP(getDisplayIP())){
                //after we have a valid ip try websocket again
                await delayAS(6000);
                connectWS();
                await delayAS(6000);
                //if not connected try usb
                if(isConnected()){
                    displayMessage("Connected!");
                } else {
                    displayMessage("Connection Failed.");
                }
            }
        } else if (isConnected()) {
                displayMessage("Enter WiFi SSID (your WiFi network name) and Password below!");
                await delayAS(3000);
                displayMessage("You can Scan for WiFi networks, then select yours");
                await delayAS(3000);
                displayMessage("Enter your WiFi password, then press 'Connect To Router'");
                await delayAS(3000);
                displayMessage("Then once you have an IP address you can connect Wireless!");
        } else {
                displayMessage("Something went wrong, try again");
                await delayAS(3000);
                displayMessage("If it didn't show up on the list, make sure it is powered on.");
                await delayAS(3000);
                displayMessage("restart the eBrain and make sure the USB cable is well plugged in.");
                await delayAS(3000);
                displayMessage("make sure it is connected to your WiFi network");
        }
    }

    await delayAS(20000);
    if ( isConnected() ) {
         displayMessage("Not Connected - See the Guidebook on How To Connect for more info");
    }

}



function connectionWizard() {
    const ssid = document.getElementById("ssid-select").value;
    const pass = document.getElementById("pass").value;
    saveToLocalStorage("eBrain_ssid", ssid);
    saveToLocalStorage("eBrain_pass", pass);
    var message = {"cmd": "setConfig", "arg": {"sta_ssid": ssid , "sta_pass": pass}};
    //JSON Command, Function to do on successful completion (where rtnMsg is the returned message of the complete command)
    send_msg(message, function(rtnMsg){
        displayIP(rtnMsg.msg.sta_ip);
    });
}


function wifiCheck() {
    send_msg({"cmd": "startWifiScan"}, function(rtnMsg){
        var wifi = "";
        if(typeof rtnMsg.msg === "undefined"){
          return;
        }
        for(var i = 0; i < rtnMsg.msg.length; i++) {
            wifi += "<option value ='" + rtnMsg.msg[i][0] + "' >";
            wifi += rtnMsg.msg[i][0];
            wifi += "</option>";
        }
        document.getElementById("ssid").innerHTML = wifi;
    });
}

function connectWS() {
  var url  = "ws://"+getDisplayIP()+":8899/websocket";
  displayMessage("...conecting: " + url);
  var msg = {'cmd':'url','msg':url}
  send_msg(msg,function(rtnMsg){});
}

function closeWS() {
  displayMessage("Closing Socket");
  var msg = {'cmd':'close'};
  send_msg(msg,function(rtnMsg){});
}

function sendJsonText() {
  var jsonInput = document.getElementById("jsonInput").value;
  try {
    jsonInput = JSON.parse(jsonInput);
  } catch (e) {
    displayMessage(e);
  }
  send_msg(jsonInput,function(rtnMsg){});
}

function USBmsg(){
    const messageId = Math.random().toString(36).substr(2, 9); 
    var msg;
    msg = {'cmd':'usb','id':messageId};
    send_msg(msg,function(rtnMsg){});
}

function closeSerial() {
  displayMessage("Closing USB");
  var msg = {'cmd':'closeUSB'};
  send_msg(msg,function(rtnMsg){});
}

function chk(state){
    const btn = document.getElementById("connectedIndicator");
    const ip = document.getElementById("ip");
    const name = document.getElementById("robotName");
    if(state == true){
        btn.classList.add("connected");
        name.classList.add("connectedTXT");
        ip.classList.add("connectedTXT");
        btn.classList.remove("disconnected");
        name.classList.remove("disconnectedTXT");
        ip.classList.remove("disconnectedTXT");
    } else {
        btn.classList.add("disconnected");
        name.classList.add("disconnectedTXT");
        ip.classList.add("disconnectedTXT");
        btn.classList.remove("connected");
        name.classList.remove("connectedTXT");
        ip.classList.remove("connectedTXT");
    }
}

function isConnected() {
    const element = document.getElementById("connectedIndicator");
    return element?.classList.contains("connected") || false;
}


function saveToLocalStorage(key, value) {
    localStorage.setItem(key, value);
}
function getFromLocalStorage(key) {
    return localStorage.getItem(key);
}


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



function makeEditable(element) {
    // Store original text in case of cancelation
    let originalText = element.innerText;

    // Make the element editable
    element.contentEditable = "true";
    element.focus();

    // Handle "Enter" key or blur event to save
    function saveChanges(event) {
        if (event.type === "blur" || (event.type === "keydown" && event.key === "Enter")) {
            element.contentEditable = "false";
            element.removeEventListener("blur", saveChanges);
            element.removeEventListener("keydown", saveChanges);
        }
    }

    // If the user presses Enter or clicks away, save the changes
    element.addEventListener("blur", saveChanges);
    element.addEventListener("keydown", saveChanges);
}


function delayAS(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeWriter(text) {
    let index = 0;
    let charIndex = 0;
    let outputElement = document.getElementById("output");
    text = text.toString();
    for(index=0; index < text.length; index++){
        outputElement.innerHTML += text[index];
        await delayAS(30);
    }
    outputElement.innerHTML += "\n";
    checkLines();
}

function checkLines() {
    const outputDiv = document.getElementById("output");

    // Count number of lines by splitting on new lines
    const lines = outputDiv.innerText.split("\n").filter(line => line.trim() !== "").length;

    // If lines exceed 11, clear the div
    if (lines > 9) {
        outputDiv.innerText = "";
    }
}




 const commands = [
            "version", "ping", "uptime", "pause", "resume", "stop",
            "slackCalibration", "moveCalibration", "turnCalibration",
            "calibrateMove", "calibrateTurn", "forward", "back",
            "right", "left", "beep", "calibrateSlack", "analogInput",
            "readSensors", "digitalInput", "digitalNotify",
            "digitalStopNotify", "gpio_on", "gpio_off", "gpio_pwm_16",
            "gpio_pwm_5", "gpio_pwm_10", "temperature", "humidity",
            "distanceSensor", "compassSensor", "postToServer",
            "leftMotorF", "leftMotorB", "rightMotorF", "rightMotorB",
            "speedMove", "speedMoveSteps", "servo", "servoII",
            "pinServo", "getConfig", "setConfig", "resetConfig",
            "freeHeap", "startWifiScan"
        ];

        const selectElement = document.getElementById("commandSelect");
        const argInput = document.getElementById("argInput");
        const jsonInput = document.getElementById("jsonInput");

        // Populate dropdown with commands
        commands.forEach(cmd => {
            let option = document.createElement("option");
            option.value = cmd;
            option.textContent = cmd;
            selectElement.appendChild(option);
        });

        function generateJSON() {
            const selectedCommand = selectElement.value;
            const argumentsValue = argInput.value.trim();

            if (!selectedCommand) return; // Ignore if nothing is selected

            const jsonObject = {
                cmd: selectedCommand,
                arg: argumentsValue
            };

            jsonInput.value = JSON.stringify(jsonObject, null, 2);
        }

        // Trigger JSON generation when selecting a command or entering arguments
        selectElement.addEventListener("change", generateJSON);
        argInput.addEventListener("input", generateJSON);
