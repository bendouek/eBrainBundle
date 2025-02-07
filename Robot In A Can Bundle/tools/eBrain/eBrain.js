var escapable = /[\x00-\x1f\ud800-\udfff\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufff0-\uffff]/g;
let outputStream, inputStream;
let inputDone, outputDone;
var eb;
var port;
let socket;
let reconnectInterval = 3000; // 3 seconds
let maxRetries = 5;
let retryCount = 0;



function filterUnicode(quoted){

  escapable.lastIndex = 0;
  if( !escapable.test(quoted)) return quoted;

  return quoted.replace( escapable, function(a){
    return '';
  });
}


var EveBrain = function() {
  this.cbs = {};
  // Initially, set connected to true if there is a port.
  if (port) {
    this.connected = true;
  } else {
    this.connected = false;
  }
};

EveBrain.prototype = {
     send_msg: function(message, callback,id) {
      if (id === undefined) {
        message.id = Math.random().toString(36).substring(2, 12);
      } else {
        message.id = id;
      }

      //set the callback function to run when message recieves a reply
      if (callback) {
        this.cbs[message.id] = callback;
        //alert(this.cbs[message.id]);
      }

      //check how message is formed and turn into json string
      if (!(message instanceof Object)) {
        message = JSON.stringify(JSON.parse(message));
      } else {
        message = JSON.stringify(message);
      }

      //Check USB or WS connection, favor WS, and send appropriatley
      if(socket && socket.readyState === WebSocket.OPEN) {
        sendDataWS(message);
      } else if (port && port.readable){
        sendDataUSB(message);
      } else {
        this.connected = false;
      }         
    },

    doCallback: function(message) {
        if (!(message instanceof Object)) {
          message = JSON.parse(message);
        }
        //run the callback
        if(typeof message.id !== "undefined"){
          try {
            this.cbs[message.id](message);
            //delete this.cbs[message.id]; // Clean up
            if (eb) {
              eb.connected = true; // we got a response so we are connected
            }
          } catch (e) {
            console.log("callback failed");
          }
        }
        
    },

    chkConnection: function(){
      return this.connected;
    }
}


async function USBconnect() {
  const tempButton = document.createElement("button");
  tempButton.id = "connectTemp";
  tempButton.innerText = "Click to Connect";
  tempButton.style.position = "absolute";
  tempButton.style.top = "50%";
  tempButton.style.left = "25%";
  tempButton.style.transform = "translate(-50%, -50%)";
  tempButton.style.padding = "10px 20px";
  tempButton.style.fontSize = "16px";
  tempButton.style.border = "8px solid #008000";

  tempButton.addEventListener("click", async () => {
      try {
          // Request & open port here.
          port = await navigator.serial.requestPort();

          if (eb) {
            eb.connected = true;
          }
          // Wait for the port to open.
          await port.open({ baudRate: 230400 });
          // on disconnect, alert user and pause Snap!
          port.addEventListener('disconnect', event => {
            if (eb) {
              eb.connected = false; // signal disconnection to other code.
            }
          });

          window.addEventListener("beforeunload", closeSerialGracefully);
          window.addEventListener("unload", closeSerialGracefully);
          navigator.serial.addEventListener("disconnect", closeSerialGracefully);

          // Setup the output stream
          const encoder = new TextEncoderStream();
          outputDone = encoder.readable.pipeTo(port.writable);
          outputStream = encoder.writable;

          // Make stream
          let decoder = new TextDecoderStream();
          inputDone = port.readable.pipeTo(decoder.writable);
          inputStream = decoder.readable;

          reader = inputStream.getReader();
          readLoop(); // Start infinite read loop
      } catch (error) {
          console.error("Error connecting to device:", error);
      }
      document.body.removeChild(tempButton); // Remove button after use
  });

  // Append button to the page
  document.body.appendChild(tempButton);
  
}


async function closeSerialGracefully() {
    if (port && port.readable) {
        try {
            await port.close();
            console.log("Serial closed.");
            if (eb) {
              eb.connected = false; // signal disconnection to other code.
            }
        } catch (err) {
            console.error("Error closing serial:", err);
        }
    }
}



  /**
   * This reads from the serial in a loop, and 
   * runs the given callbacks (using ebUSB).
   */
async function readLoop() {
  let buffer = "";
  console.log("USB Reader Listening...");
  
  try {
    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            console.log("[readLoop] DONE");
            reader.releaseLock();
            break;
        }
        
        buffer += value;
        console.log(value + '\n');

        let messages = { parsed: [] };
        let jsons = buffer.split('\r\n');
        
        buffer = jsons.pop(); // Keep potential incomplete JSON
        
        for (let json of jsons) {
            try {
                let response = JSON.parse(json);
                if (response && typeof response === "object") {
                    messages.parsed.push(response);
                }
            } catch (e) {
                console.error("Failed to parse JSON:", e);
            }
        }
        
        messages.parsed.forEach(message => {
            displayMessage(JSON.stringify(message));
            if (typeof eb !== "undefined") {
                eb.doCallback(message);
            }
        });
    }
  } catch (error) {
      console.error("Serial disconnected:", error);
      closeSerialGracefully(); // Ensure cleanup
  } finally {
      reader.releaseLock();
  }
}


function writeToStream(...lines) {
  // Write to output stream
  const writer = outputStream.getWriter();
  lines.forEach((line) => {
    console.log('[SEND]', line);
    writer.write(line + '\n');
  });
  writer.releaseLock();
}

async function sendDataUSB(msg) {
    if (!outputStream) {
        console.error("No serial connection established.");
        return;
    }
    try {
       message = filterUnicode(msg);
       writeToStream(message);
    } catch (err) {
        console.error("Invalid JSON format:", err);
    }
}


async function sendDataWS(data) {
    message = filterUnicode(data);
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(message);
        displayMessage("Data sent: "+ data);
      } catch (err) {
        console.error("Invalid JSON format:", err);
      }
    } else {
        displayMessage("Cannot send data, WebSocket is not open.");
    }
}


function closeWS(){
  if (socket.readyState === WebSocket.OPEN) {
      socket.close();
      retryCount = maxRetries;
      if (eb) {
        eb.connected = false; // signal disconnection to other code.
      }
  }
}


function connect(url) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        displayMessage("Already connected.");
        return;
    }

    console.log("Attempting to connect to ESP8266 WebSocket...");
    socket = new WebSocket(url);

    socket.onopen = function () {
        displayMessage("Connected to ESP8266 WebSocket");
        retryCount = 0; // Reset retry count on successful connection
        if (eb) {
          eb.connected = true;
        }
    };

    socket.onmessage = function (event) {
        displayMessage("Message from ESP8266: " + event.data);
        if (typeof eb !== "undefined") {
            eb.doCallback(event.data);
        }
    };

    socket.onerror = function (error) {
        displayMessage("WebSocket error: " + error);
    };

    socket.onclose = function (event) {
        displayMessage("WebSocket closed: " + event);
        if (eb) {
          eb.connected = false; // signal disconnection to other code.
        }
        if (retryCount < maxRetries) {
            retryCount++;
            displayMessage(`Reconnecting in ${reconnectInterval / 1000} seconds... (Attempt ${retryCount}/${maxRetries})`);
            setTimeout(() => connect(url), reconnectInterval);
        } else {
            displayMessage("Socket Closed. Manual reconnection required.");
        }
    };
}

function displayMessage(msg){
  console.log(msg)
}

function checkConnection(){

}

function delay(callback) {
    setTimeout(callback, 3000); // 1000ms = 1 second
}


eb = new EveBrain();


window.addEventListener("message", (event) => {
    if (!event.data || !event.data.id) return;

    console.log("snapiframe:", event.data);
    if(event.data.cmd == "usb"){
        USBconnect();
        delay(() => {
          var msg = {'msg':'USB connected: '+eb.chkConnection(),'id':event.data.id};
          window.parent.postMessage(msg,"*");
        }); 
    } else if (event.data.cmd == "url"){
        connect(event.data.msg);
        // Example usage:
        delay(() => {
          var msg = {'msg':'WebSocket connected: '+eb.chkConnection(),'id':event.data.id};
          window.parent.postMessage(msg,"*");
        }); 
    }else if (event.data.cmd == "close"){
        closeWS();
        var msg = {'msg':'websocket closed','id':event.data.id};
        window.parent.postMessage(msg,"*");
    }else if (event.data.cmd == "closeUSB"){
        closeSerialGracefully();
        delay(() => {
          var msg = {'msg':'USB connected: '+eb.chkConnection(),'id':event.data.id};
          window.parent.postMessage(msg,"*");
        }); 
    }else {
        eb.send_msg(event.data, function(e){
                window.parent.postMessage(e,"*");
            }, event.data.id);
    }
});


function watchBoolean(obj, key, callback) {
    let previousValue = obj[key];

    Object.defineProperty(obj, key, {
        get() {
            return previousValue;
        },
        set(newValue) {
            if (newValue !== previousValue) {
                previousValue = newValue;
                callback(newValue);
            }
        }
    });
}



watchBoolean(eb, "connected", (newState) => {
    console.log("State changed to:", newState);
    var msg = {'msg':newState,'cmd':'chk'};
    window.parent.postMessage(msg,"*");
});