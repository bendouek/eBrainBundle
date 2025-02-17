/*
 * This regular expression is used to filter out unwanted Unicode characters that might cause issues.
 * It matches control characters and other problematic Unicode ranges.
 */
var escapable = /[\x00-\x1f\ud800-\udfff\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufff0-\uffff]/g;
let outputStream, inputStream;  // Streams for USB/Serial communication.
let inputDone, outputDone;      // Promises for stream closure.
var eb;                         // Instance of EveBrain for messaging and connection status.
var port;                       // Serial port object.
let socket;                     // WebSocket instance for network communication.
let reconnectInterval = 3000;   // 3 seconds delay between WebSocket reconnection attempts.
let maxRetries = 5;             // Maximum number of WebSocket reconnection attempts.
let retryCount = 0;             // Current WebSocket reconnection attempt count.
let ebMSG = 0;                  // Global variable to pass ansync information to Snap!
let snapBlocking = 0;           // Global variable to control block flow of Snap!

/**
 * Filters out unwanted Unicode characters from the provided string.
 * @param {string} quoted - The string to filter.
 * @returns {string} - The filtered string.
 */
function filterUnicode(quoted) {
  escapable.lastIndex = 0; // Reset regex index to start matching from beginning.
  if (!escapable.test(quoted)) return quoted; // If no unwanted characters, return original string.

  // Replace any characters matching the regex with an empty string.
  return quoted.replace(escapable, function(a) {
    return '';
  });
}


/**
 * Constructor for the EveBrain object.
 * This object manages message callbacks and maintains connection state.
 */
var EveBrain = function() {
  this.cbs = {}; // Object to store callbacks keyed by message ID.
  // Set initial connection state based on the existence of a port.
  if (port) {
    this.connected = true;
  } else {
    this.connected = false;
  }
};

EveBrain.prototype = {
  /**
   * Sends a message over the active connection (WebSocket or USB).
   * @param {Object|string} message - The message to send.
   * @param {Function} callback - Optional callback for the message response.
   * @param {string} [id] - Optional ID for the message; a random ID is generated if not provided.
   */
  send_msg: function(message, callback, id) {
    // Assign a random message ID if none is provided.
    if (id === undefined) {
      message.id = Math.random().toString(36).substring(2, 12);
    } else {
      message.id = id;
    }

    // If a callback is provided, store it to be called upon receiving a response.
    if (callback) {
      this.cbs[message.id] = callback;
    }

    // Ensure the message is a JSON string. If it's not an object, try parsing and re-stringifying.
    if (!(message instanceof Object)) {
      message = JSON.stringify(JSON.parse(message));
    } else {
      message = JSON.stringify(message);
    }

    // Determine the appropriate connection method.
    if (socket && socket.readyState === WebSocket.OPEN) {
      sendDataWS(message); // Prefer WebSocket if available.
    } else if (port && port.readable) {
      sendDataUSB(message); // Fall back to USB if WebSocket is not open.
    } else {
      this.connected = false; // Mark as disconnected if no connection exists.
    }
  },

  /**
   * Executes the callback associated with a received message.
   * @param {Object|string} message - The message received.
   */
  doCallback: function(message) {
    // Parse the message if it is not already an object.
    if (!(message instanceof Object)) {
      message = JSON.parse(message);
    }
    // Execute the callback if the message contains an ID.
    if (typeof message.id !== "undefined") {
      try {
        this.cbs[message.id](message);
        // Optionally, you could remove the callback after execution (cleanup code commented out).
        // delete this.cbs[message.id];
        if (eb) {
          eb.connected = true; // Since a response was received, mark the connection as active.
        }
      } catch (e) {
        console.log("callback failed");
      }
    }
  },

  /**
   * Returns the current connection status.
   * @returns {boolean} - The connection state.
   */
  chkConnection: function() {
    return this.connected;
  }
}


/**
 * Initiates a USB/Serial connection by prompting the user to select a port.
 * Sets up input and output streams for communication.
 */
async function USBconnect() {
  // Create a temporary button that the user must click to grant USB access.
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

  // Event listener for the button click to initiate connection.
  tempButton.addEventListener("click", async () => {
    try {
      // Prompt the user to select a serial port.
      port = await navigator.serial.requestPort();

      if (eb) {
        eb.connected = true;
      }
      // Open the port with a baud rate of 115200.
      await port.open({ baudRate: 115200 });
      
      // Listen for disconnect events to update the connection state.
      port.addEventListener('disconnect', event => {
        if (eb) {
          eb.connected = false;
        }
      });

      // Set up listeners to gracefully close the port when the page unloads.
      window.addEventListener("beforeunload", closeSerialGracefully);
      window.addEventListener("unload", closeSerialGracefully);
      navigator.serial.addEventListener("disconnect", closeSerialGracefully);

      // Set up the output stream using a TextEncoder.
      const encoder = new TextEncoderStream();
      outputDone = encoder.readable.pipeTo(port.writable);
      outputStream = encoder.writable;

      // Set up the input stream using a TextDecoder.
      let decoder = new TextDecoderStream();
      inputDone = port.readable.pipeTo(decoder.writable);
      inputStream = decoder.readable;

      // Get a reader from the input stream and start reading data.
      reader = inputStream.getReader();
      readLoop(); // Start the continuous read loop.
    } catch (error) {
      console.error("Error connecting to device:", error);
    }
    // Remove the temporary button after the connection is established.
    document.body.removeChild(tempButton);
  });

  // Append the connect button to the document.
  document.body.appendChild(tempButton);
}


/**
 * Closes the serial connection gracefully, ensuring resources are cleaned up.
 */
async function closeSerialGracefully() {
  if (port && port.readable) {
    try {
      await port.close();
      console.log("Serial closed.");
      if (eb) {
        eb.connected = false;
      }
    } catch (err) {
      console.error("Error closing serial:", err);
    }
  }
}


/**
 * Continuously reads data from the USB/Serial port.
 * Buffers incoming data, splits it into JSON messages, and processes each message.
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
      
      // Append received data to the buffer.
      buffer += value;
      console.log(value + '\n');

      // Split the buffer by newline characters to separate potential JSON messages.
      let messages = { parsed: [] };
      let jsons = buffer.split('\r\n');
      
      // Save the last (possibly incomplete) segment back to the buffer.
      buffer = jsons.pop();
      
      // Parse each complete JSON segment.
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
      
      // Process each parsed message: display it and trigger any associated callbacks.
      messages.parsed.forEach(message => {
        displayMessage(JSON.stringify(message));
        if (typeof eb !== "undefined") {
          eb.doCallback(message);
        }
      });
    }
  } catch (error) {
    console.error("Serial disconnected:", error);
    closeSerialGracefully(); // Ensure proper cleanup on error.
  } finally {
    reader.releaseLock();
  }
}


/**
 * Writes an array of lines to the output stream.
 * @param {...string} lines - The lines to be written.
 */
function writeToStream(...lines) {
  // Acquire a writer from the output stream.
  const writer = outputStream.getWriter();
  lines.forEach((line) => {
    console.log('[SEND]', line);
    writer.write(line + '\n'); // Append a newline character after each line.
  });
  writer.releaseLock(); // Release the writer to allow other writes.
}

/**
 * Sends data over the USB/Serial connection after filtering unwanted characters.
 * @param {string} msg - The message to be sent.
 */
async function sendDataUSB(msg) {
  if (!outputStream) {
    console.error("No serial connection established.");
    return;
  }
  try {
    // Remove problematic Unicode characters from the message.
    message = filterUnicode(msg);
    writeToStream(message);
  } catch (err) {
    console.error("Invalid JSON format:", err);
  }
}


/**
 * Sends data over the WebSocket connection after filtering unwanted characters.
 * @param {string} data - The message to be sent.
 */
async function sendDataWS(data) {
  message = filterUnicode(data);
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(message);
      displayMessage("Data sent: " + data);
    } catch (err) {
      console.error("Invalid JSON format:", err);
    }
  } else {
    displayMessage("Cannot send data, WebSocket is not open.");
  }
}


/**
 * Closes the WebSocket connection if it is currently open.
 */
function closeWS() {
  if (socket.readyState === WebSocket.OPEN) {
    socket.close();
    retryCount = maxRetries; // Prevent further reconnection attempts.
    if (eb) {
      eb.connected = false;
    }
  }
}


/**
 * Initiates a WebSocket connection to the specified URL.
 * Handles connection events and attempts automatic reconnections if needed.
 * @param {string} url - The WebSocket URL to connect to.
 */
function connect(url) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    displayMessage("Already connected.");
    return;
  }

  console.log("Attempting to connect to ESP8266 WebSocket...");
  socket = new WebSocket(url);

  // Handle successful connection.
  socket.onopen = function () {
    displayMessage("Connected to ESP8266 WebSocket");
    retryCount = 0; // Reset the retry counter upon successful connection.
    if (eb) {
      eb.connected = true;
    }
  };

  // Handle incoming messages.
  socket.onmessage = function (event) {
    displayMessage("Message from ESP8266: " + event.data);
    if (typeof eb !== "undefined") {
      eb.doCallback(event.data);
    }
  };

  // Handle errors.
  socket.onerror = function (error) {
    displayMessage("WebSocket error: " + error);
  };

  // Handle connection closure and attempt reconnection if under the retry limit.
  socket.onclose = function (event) {
    displayMessage("WebSocket closed: " + event);
    if (eb) {
      eb.connected = false;
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

/**
 * Displays a message in the console.
 * @param {string} msg - The message to display.
 */
function displayMessage(msg) {
  console.log(msg);
}

/**
 * Dummy function for checking connection status (currently not implemented).
 */
function checkConnection() {

}

/**
 * Delays the execution of a callback by 3 seconds.
 * @param {Function} callback - The function to execute after the delay.
 */
function delay(callback) {
  setTimeout(callback, 3000); // 3000ms = 3 seconds
}


// Instantiate the EveBrain object to manage messaging and connection state.
eb = new EveBrain();


/**
 * Event listener for messages from the parent window.
 * Processes commands for USB/WebSocket connection, closing connections, and message forwarding.
 */
window.addEventListener("message", (event) => {
  // Ignore messages without data or a message ID.
  if (!event.data || !event.data.id) return;

  console.log("snapiframe:", event.data);
  if (event.data.cmd == "usb") {
    // Start the USB connection process.
    USBconnect();
    delay(() => {
      var msg = { 'msg': 'USB connected: ' + eb.chkConnection(), 'id': event.data.id };
      window.parent.postMessage(msg, "*");
    });
  } else if (event.data.cmd == "url") {
    // Start the WebSocket connection process with the provided URL.
    connect(event.data.msg);
    delay(() => {
      var msg = { 'msg': 'WebSocket connected: ' + eb.chkConnection(), 'id': event.data.id };
      window.parent.postMessage(msg, "*");
    });
  } else if (event.data.cmd == "close") {
    // Close the WebSocket connection.
    closeWS();
    var msg = { 'msg': 'websocket closed', 'id': event.data.id };
    window.parent.postMessage(msg, "*");
  } else if (event.data.cmd == "closeUSB") {
    // Close the USB/Serial connection.
    closeSerialGracefully();
    delay(() => {
      var msg = { 'msg': 'USB connected: ' + eb.chkConnection(), 'id': event.data.id };
      window.parent.postMessage(msg, "*");
    });
  } else {
    // Forward any other messages via EveBrain's messaging system.
    eb.send_msg(event.data, function(e) {
      window.parent.postMessage(e, "*");
    }, event.data.id);
  }
});


/**
 * Monitors changes to a specified boolean property on an object.
 * When the property changes, the provided callback is executed.
 * @param {Object} obj - The object containing the property.
 * @param {string} key - The property name to watch.
 * @param {Function} callback - The function to call when the property value changes.
 */
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

// Monitor the 'connected' state of the EveBrain instance and notify the parent window when it changes.
watchBoolean(eb, "connected", (newState) => {
  console.log("State changed to:", newState);
  var msg = { 'msg': newState, 'cmd': 'chk' };
  window.parent.postMessage(msg, "*");
});
