# **eBrain ESP8266 Firmware README**

Key Features
WiFi & WebSocket Server

Connects to a WiFi network using credentials stored in EEPROM.
Hosts a WebSockets server on port 8899 for real-time command communication.
Supports multiple WebSocket clients and monitors their activity.
Handles timeouts and reconnects WiFi if needed.
EEPROM-Based Settings Management

Stores calibration values, WiFi credentials, and other parameters in EEPROM.
Supports loading, saving, and resetting settings.
Motor Control

Controls two stepper motors (28BYJ-48) via a shift register.
Implements an efficient stepper state machine.
Allows stepper movement commands via WebSockets.
Supports batch movement for multiple steppers.
Servo Control

Manages up to 4 continuous servos and 4 standard servos.
Accepts WebSocket commands to set speeds and angles dynamically.
GPIO Control

Supports digital and analog reads/writes.
Accepts WebSocket commands to toggle GPIO pins or read their states.
JSON-Based Command Processing

Commands are sent in JSON format.
Handles various control actions like setting WiFi credentials, moving motors, and controlling servos.
Broadcasts responses back to all WebSocket clients.
Resiliency & Monitoring

Implements timeout mechanisms for WebSocket clients.
Uses watchdog-friendly design (yield(); in loop()).
Detects stalled server conditions and restarts the ESP8266.
Potential Issues / Improvements
Memory Usage & Heap Management:

Dynamic memory allocations (std::vector<ClientEntry> allClients) could fragment heap over time.
Replacing new WebsocketsClient(client) with a pre-allocated pool may improve stability.
Watchdog & Task Timing:

The loop() function may benefit from optimizing polling intervals to prevent the watchdog timer from resetting the ESP.
Security:

WiFi credentials are stored in EEPROM as plaintext, making it vulnerable if accessed.
Adding basic authentication for WebSocket connections would improve security.
Better Stepper Control Timing:

The step interval (500 µs) could be optimized further for smooth motion.
Consider using a timer interrupt instead of micros() polling.
WiFi Recovery Logic:

If WiFi disconnects, it retries indefinitely. It might be better to fall back into AP mode for user configuration.


This firmware provides a robust WebSocket server on port **8899** that allows you to control various hardware features on your robot. These features include:

* Retrieving the firmware version  
* Managing WiFi credentials  
* Digital and analog I/O  
* Servo control (continuous and regular)  
* Stepper motor control via a shift register (single or multiple steppers)  
* System calibration settings (with derived parameters for movement)  
* Scanning for available WiFi networks  
* Issuing beeps

All commands are issued as JSON messages. Optionally, each command may include an `"id"` field so that the client can match responses with requests.

**Note:** The firmware stores calibration settings (including WiFi credentials) in a single Settings structure (with defaults in PROGMEM). When settings are updated via a command, derived parameters (such as `steps_per_mm` and `steps_per_degree`) are recalculated.

## **JSON Command Reference**

Below are examples for all supported commands:

### **1\. Version**

**Description:** Returns the firmware version.

**Request:**

json  
Copy  
`{"cmd": "version", "id": "myID123"}`

**Expected Response:**

json  
Copy  
`{"msg": "4.0", "id": "myID123"}`

---

### **2\. Set WiFi**

**Description:** Sets new WiFi credentials and restarts the device.

**Request:**

json  
Copy  
`{"cmd": "set_wifi", "ssid": "YourSSID", "pass": "YourPassword", "id": "setWifi1"}`

**Expected Response:**  
A confirmation message indicating the new credentials are saved, after which the ESP will restart.

---

### **3\. Get IP**

**Description:** Returns the current local IP address.

**Request:**

json  
Copy  
`{"cmd": "get_ip", "id": "getIp1"}`

**Expected Response:**

json  
Copy  
`{"ip": "192.168.1.x", "id": "getIp1"}`

---

### **4\. Digital Read**

**Description:** Reads the digital value (HIGH or LOW) from a specified pin.

**Request:**

json  
Copy  
`{"cmd": "digital_read", "pin": 5, "id": "dr1"}`

**Expected Response (example):**

json  
Copy  
`{"value": 1, "id": "dr1"}`

---

### **5\. Analog Read**

**Description:** Reads the analog value from pin A0.

**Request:**

json  
Copy  
`{"cmd": "analog_read", "id": "ar1"}`

**Expected Response (example):**

json  
Copy  
`{"value": 512, "id": "ar1"}`

---

### **6\. Digital Write**

**Description:** Writes a digital value to a specified pin. The value can be given as `"on"`, `"HIGH"`, `"off"`, `"LOW"`, or as 1/0.

**Request:**

json  
Copy  
`{"cmd": "digital_write", "pin": 5, "value": "on", "id": "dw1"}`

**Expected Response:**

json  
Copy  
`{"msg": "Digital write executed", "id": "dw1"}`

---

### **7\. PWM Write**

**Description:** Writes a PWM (analog) value to a specified pin.

**Request:**

json  
Copy  
`{"cmd": "pwm_write", "pin": 6, "value": 128, "id": "pwm1"}`

**Expected Response:**

json  
Copy  
`{"msg": "PWM write executed", "id": "pwm1"}`

---

### **8\. Continuous Servo**

**Description:** Sets the speed for a continuous rotation servo. (A speed of 90 stops the servo.)

**Request:**

json  
Copy  
`{"cmd": "continuous_servo", "pin": 9, "speed": 90, "id": "cs1"}`

**Expected Response:**

json  
Copy  
`{"msg": "Continuous servo updated", "id": "cs1"}`

---

### **9\. Regular Servo**

**Description:** Sets the angle for a standard servo (0–180 degrees).

**Request:**

json  
Copy  
`{"cmd": "regular_servo", "pin": 10, "angle": 90, "id": "rs1"}`

**Expected Response:**

json  
Copy  
`{"msg": "Regular servo updated", "id": "rs1"}`

---

### **10\. Stepper Turn**

**Description:** Initiates movement on a single stepper motor controlled via the shift register.  
**Parameters:**

* `"motor"`: Motor index (0 to NUM\_STEPPERS \- 1\)  
* `"steps"`: Number of steps to move  
* `"direction"`: `1` for forward, `0` for backward

**Request:**

json  
Copy  
`{"cmd": "stepper_turn", "motor": 0, "steps": 100, "direction": 1, "id": "st1"}`

**Expected Response:**

json  
Copy  
`{"msg": "Stepper turning initiated", "id": "st1"}`

---

### **11\. Stepper Turn Multi**

**Description:** Initiates movement on multiple stepper motors simultaneously.  
**Parameters:**  
An array `"motors"` where each element is an object with:

* `"motor"`: Motor index  
* `"steps"`: Number of steps  
* `"direction"`: Direction (1 for forward, 0 for backward)

**Request:**

json  
Copy  
`{`  
  `"cmd": "stepper_turn_multi",`  
  `"motors": [`  
    `{"motor": 0, "steps": 100, "direction": 1},`  
    `{"motor": 1, "steps": 150, "direction": 0}`  
  `],`  
  `"id": "stm1"`  
`}`

**Expected Response:**

json  
Copy  
`{"msg": "Stepper multi-turn initiated", "id": "stm1"}`

---

### **12\. Update Settings**

**Description:** Updates the firmware calibration and configuration settings, including WiFi credentials. The following fields can be updated:

* `version`  
* `slackCalibration`  
* `moveCalibration`  
* `turnCalibration`  
* `wheelDiameter`  
* `wheelDistance`  
* `wifi_ssid`  
* `wifi_pass`

After updating, the firmware recalculates the derived parameters (`steps_per_mm` and `steps_per_degree`).

**Request:**

json  
Copy  
`{`  
  `"cmd": "update_settings",`  
  `"version": 1,`  
  `"slackCalibration": 14,`  
  `"moveCalibration": 1.0,`  
  `"turnCalibration": 1.0,`  
  `"wheelDiameter": 70.0,`  
  `"wheelDistance": 150.0,`  
  `"wifi_ssid": "NewSSID",`  
  `"wifi_pass": "NewPassword",`  
  `"id": "us1"`  
`}`

**Expected Response (example):**

json  
Copy  
`{`  
  `"msg": "Settings updated",`  
  `"version": 1,`  
  `"slackCalibration": 14,`  
  `"moveCalibration": 1.0,`  
  `"turnCalibration": 1.0,`  
  `"wheelDiameter": 70.0,`  
  `"wheelDistance": 150.0,`  
  `"wifi_ssid": "NewSSID",`  
  `"steps_per_mm": 0.909,`  
  `"steps_per_degree": 3.926,`  
  `"id": "us1"`  
`}`

*Note: The numeric values for `steps_per_mm` and `steps_per_degree` will vary based on your constants.*

---

### **13\. WiFi Scan**

**Description:** Scans for available WiFi networks and returns an array of detected SSIDs.

**Request:**

json  
Copy  
`{"cmd": "wifi_scan", "id": "ws1"}`

**Expected Response (example):**

json  
Copy  
`{`  
  `"ssids": ["Network1", "Network2", "Network3"],`  
  `"id": "ws1"`  
`}`

---

### **14\. Beep**

**Description:** Issues a beep on a specified pin with a given frequency (in Hz) and duration (in milliseconds).

**Request:**

json  
Copy  
`{"cmd": "beep", "pin": 8, "frequency": 1000, "duration": 500, "id": "b1"}`

**Expected Response:**

json  
Copy  
`{"msg": "Beep issued", "id": "b1"}`

---

## **Summary**

This firmware offers a comprehensive JSON command interface over WebSockets, allowing you to:

* Retrieve firmware version  
* Configure WiFi and update network credentials  
* Read and write digital and analog I/O  
* Control servos (both continuous and regular)  
* Drive stepper motors via a shift register (individually or in groups)  
* Update calibration settings (including deriving movement parameters)  
* Scan for available WiFi networks  
* Generate audible beeps

Each command is sent as a JSON object, and the firmware responds with a corresponding JSON response, echoing the optional `"id"` for tracking.

Adjust the configuration constants, timing intervals, and hardware-specific values as needed for your specific setup.

Happy coding and debugging\!

