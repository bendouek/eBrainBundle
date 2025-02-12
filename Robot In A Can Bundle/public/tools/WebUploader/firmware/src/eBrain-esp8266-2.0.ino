#include <ArduinoWebsockets.h>
#include <ESP8266WiFi.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <Servo.h>
#include <vector>
#include "ShiftStepper.h"

using namespace websockets;  // Use the websockets namespace

// ==================
// Settings Definitions
// ==================
#define SETTINGS_VERSION          1
#define DEFAULT_SLACK_CALIBRATION 14
#define DEFAULT_MOVE_CALIBRATION  1.0f
#define DEFAULT_TURN_CALIBRATION  1.0f
#define DEFAULT_DIAMETER_MM_V2    70.0f      // Example wheel diameter (mm)
#define DEFAULT_WHEEL_DISTANCE_V2 150.0f     // Example wheel distance (mm)
#define STEPS_PER_TURN            4076.8f    // For the 28BYJ-48 stepper motor

// WiFi credentials are now part of the settings.
struct Settings {
  uint8_t version;
  uint8_t slackCalibration;
  float moveCalibration;
  float turnCalibration;
  float wheelDiameter;
  float wheelDistance;
  char wifi_ssid[32];
  char wifi_pass[32];
};

// Defaults stored in PROGMEM:
const Settings defaultSettings PROGMEM = {
  SETTINGS_VERSION,
  DEFAULT_SLACK_CALIBRATION,
  DEFAULT_MOVE_CALIBRATION,
  DEFAULT_TURN_CALIBRATION,
  DEFAULT_DIAMETER_MM_V2,
  DEFAULT_WHEEL_DISTANCE_V2,
  "defaultSSID",   // Change as needed
  "defaultPass"    // Change as needed
};

Settings settings;   // runtime settings
float steps_per_mm;  // Computed as: STEPS_PER_TURN / (PI * settings.wheelDiameter)
float steps_per_degree; // Computed as: ((settings.wheelDistance * PI) / 360) * steps_per_mm

// ==================
// Global Variables for WiFi & Server
// ==================
String ssid;
String password;
WebsocketsServer server;
unsigned long lastSuccessfulPoll = 0;  // For server loop health monitoring

// ==================
// Timeout Definitions (increased)
// ==================
#define SERVER_PORT           8899
#define EEPROM_SIZE           96
#define CLIENT_TIMEOUT        60000UL    // 60 seconds
#define CLIENT_PING_INTERVAL  30000UL    // 30 seconds
#define SERVER_POLL_TIMEOUT   120000UL   // 2 minutes

// ==================
// WebSocket Client Management
// ==================
struct ClientEntry {
  WebsocketsClient* client;
  unsigned long lastActivity;
  unsigned long lastPing;
};
std::vector<ClientEntry> allClients;

// ==================
// Servo Control Management
// ==================
struct ServoControlEntry {
  int pin;
  Servo servo;
};
std::vector<ServoControlEntry> continuousServos; // up to 4 continuous servos
std::vector<ServoControlEntry> regularServos;    // up to 4 regular servos

// ==================
// Efficient Stepper Implementation (28BYJ-48)
// ==================

// Shift register pins for stepper control:
#define SHIFT_REG_DATA  12
#define SHIFT_REG_CLOCK 13
#define SHIFT_REG_LATCH 14

// We drive two stepper motors via the shift register.
#define NUM_STEPPERS 2
int data_pin = SHIFT_REG_DATA;
int clock_pin = SHIFT_REG_CLOCK;
int latch_pin = SHIFT_REG_LATCH;

// Global variable for shift register output.
uint8_t lastGlobalOutput = 0;

// Define a stepper state structure.
// We'll store the current step as a byte (the actual bit pattern).
struct EfficientStepper {
  int offset;           // Bit offset in shift register (0 for motor 0, 4 for motor 1)
  uint8_t currentStep;  // Current step state (e.g., 0x01, 0x03, etc.)
  long remaining;       // Steps remaining to move
  uint8_t direction;    // FORWARD (1) or BACKWARD (0)
  bool paused;
  String completionId;      // Stores the initiating command's id.
  bool completionReported;  // Set true once completion message has been broadcast.
};

#define FORWARD  1
#define BACKWARD 0

EfficientStepper steppers[NUM_STEPPERS];

// Implement the working stepping sequence using a switch–case.
uint8_t nextStep(uint8_t currentStep, uint8_t _dir) {
  switch(currentStep) {
    case 0x00: // B0000
    case 0x01: // B0001
      return (_dir == FORWARD ? 0x03 : 0x09);  // B0011 or B1001
    case 0x03: // B0011
      return (_dir == FORWARD ? 0x02 : 0x01);  // B0010 or B0001
    case 0x02: // B0010
      return (_dir == FORWARD ? 0x06 : 0x03);  // B0110 or B0011
    case 0x06: // B0110
      return (_dir == FORWARD ? 0x04 : 0x02);  // B0100 or B0010
    case 0x04: // B0100
      return (_dir == FORWARD ? 0x0C : 0x06);  // B1100 or B0110
    case 0x0C: // B1100
      return (_dir == FORWARD ? 0x08 : 0x04);  // B1000 or B0100
    case 0x08: // B1000
      return (_dir == FORWARD ? 0x09 : 0x0C);  // B1001 or B1100
    case 0x09: // B1001
      return (_dir == FORWARD ? 0x01 : 0x08);  // B0001 or B1000
    default:
      return 0x00;
  }
}

void updateShiftRegister(uint8_t value) {
  shiftOut(data_pin, clock_pin, MSBFIRST, value);
  digitalWrite(latch_pin, HIGH);
  digitalWrite(latch_pin, LOW);
}

void broadcastMessage(const String &jsonMessage) {
  for (size_t i = 0; i < allClients.size(); i++) {
    allClients[i].client->send(jsonMessage);
  }
}

void updateSteppers() {
  for (int i = 0; i < NUM_STEPPERS; i++) {
    EfficientStepper &s = steppers[i];
    if (!s.paused && s.remaining > 0) {
      s.currentStep = nextStep(s.currentStep, s.direction);
      s.remaining--;
    }
    // When motion is complete and not yet reported...
    if (s.remaining == 0 && !s.completionReported) {
      StaticJsonDocument<100> compDoc;
      compDoc["msg"] = "Stepper complete";
      compDoc["motor"] = i;
      if (s.completionId.length() > 0)
        compDoc["id"] = s.completionId;
      String compResp;
      serializeJson(compDoc, compResp);
      broadcastMessage(compResp);
      s.completionReported = true;
    }
  }
  uint8_t newOutput = 0;
  for (int i = 0; i < NUM_STEPPERS; i++) {
    EfficientStepper &s = steppers[i];
    uint8_t bits = (s.remaining > 0) ? s.currentStep : 0;
    newOutput |= (bits << s.offset);
  }
  if (newOutput != lastGlobalOutput) {
    lastGlobalOutput = newOutput;
    updateShiftRegister(newOutput);
  }
}

unsigned long lastStepperUpdate = 0;
const unsigned long stepInterval = 500;  // microseconds (faster stepping for 28BYJ-48)

// ==================
// EEPROM / WiFi Helper Functions (for Settings)
// ==================
bool isPrintableStr(const char *str) {
  for (int i = 0; str[i] != '\0'; i++) {
    if (str[i] < 32 || str[i] > 126)
      return false;
  }
  return true;
}

void clearEEPROMFunc() {
  for (int i = 0; i < EEPROM_SIZE; i++) {
    EEPROM.write(i, 0);
  }
  EEPROM.commit();
  Serial.println("EEPROM cleared.");
}

// IMPORTANT: First load defaults, then attempt to load EEPROM settings.
void loadCredentialsFunc() {
  // Load default settings first.
  memcpy_P(&settings, &defaultSettings, sizeof(Settings));
  // Then try to load from EEPROM to override defaults if valid.
  EEPROM.begin(EEPROM_SIZE);
  Settings tempSettings;
  EEPROM.get(0, tempSettings);
  if (strlen(tempSettings.wifi_ssid) < 2 || strlen(tempSettings.wifi_pass) < 2 ||
      !isPrintableStr(tempSettings.wifi_ssid) || !isPrintableStr(tempSettings.wifi_pass)) {
    Serial.println("Invalid settings in EEPROM. Using default settings.");
  } else {
    settings = tempSettings;
    Serial.print("Loaded WiFi SSID from EEPROM: ");
    Serial.println(settings.wifi_ssid);
    Serial.print("Loaded WiFi Password from EEPROM: ");
    Serial.println(settings.wifi_pass);
  }
  ssid = String(settings.wifi_ssid);
  password = String(settings.wifi_pass);
}

void saveCredentialsFunc(String newSsid, String newPassword) {
  newSsid.toCharArray(settings.wifi_ssid, sizeof(settings.wifi_ssid));
  newPassword.toCharArray(settings.wifi_pass, sizeof(settings.wifi_pass));
  EEPROM.begin(EEPROM_SIZE);
  EEPROM.put(0, settings);
  EEPROM.commit();
  Serial.println("Settings saved to EEPROM.");
  ssid = String(settings.wifi_ssid);
  password = String(settings.wifi_pass);
}

// ==================
// JSON Command Processing
// ==================
void processMessage(String input, WebsocketsClient *client) {
  StaticJsonDocument<300> doc;
  DeserializationError err = deserializeJson(doc, input);
  if (err) {
    Serial.print("JSON parsing failed: ");
    Serial.println(err.f_str());
    return;
  }
  String msgId = "";
  if (doc.containsKey("id"))
    msgId = doc["id"].as<String>();
  
  if (doc["cmd"] == "version") {
    StaticJsonDocument<200> response;
    response["msg"] = "4.0";
    if (msgId.length() > 0)
      response["id"] = msgId;
    String resp;
    serializeJson(response, resp);
    if (client) client->send(resp); else Serial.println(resp);
  }
  else if (doc["cmd"] == "set_wifi") {
    ssid = doc["ssid"].as<String>();
    password = doc["pass"].as<String>();
    if (ssid.length() > 0 && password.length() > 0) {
      saveCredentialsFunc(ssid, password);
      StaticJsonDocument<200> response;
      response["msg"] = "WiFi credentials saved. Restarting...";
      if (msgId.length() > 0)
        response["id"] = msgId;
      String resp;
      serializeJson(response, resp);
      if (client) client->send(resp); else Serial.println(resp);
      Serial.println("WiFi credentials saved. Restarting...");
      delay(1000);
      ESP.restart();
    } else {
      Serial.println("Invalid WiFi credentials received.");
    }
  }
  else if (doc["cmd"] == "get_ip") {
    StaticJsonDocument<200> response;
    response["ip"] = WiFi.localIP().toString();
    if (msgId.length() > 0)
      response["id"] = msgId;
    String resp;
    serializeJson(response, resp);
    if (client) client->send(resp); else Serial.println(resp);
  }
  else if (doc["cmd"] == "digital_read") {
    int pin = doc["pin"].as<int>();
    pinMode(pin, INPUT);
    int value = digitalRead(pin);
    StaticJsonDocument<200> response;
    response["value"] = value;
    if (msgId.length() > 0)
      response["id"] = msgId;
    String resp;
    serializeJson(response, resp);
    if (client) client->send(resp); else Serial.println(resp);
  }
  else if (doc["cmd"] == "analog_read") {
    int value = analogRead(A0);
    StaticJsonDocument<200> response;
    response["value"] = value;
    if (msgId.length() > 0)
      response["id"] = msgId;
    String resp;
    serializeJson(response, resp);
    if (client) client->send(resp); else Serial.println(resp);
  }
  else if (doc["cmd"] == "digital_write") {
    int pin = doc["pin"].as<int>();
    int val = LOW;
    if (doc["value"].is<const char*>()) {
      String str = doc["value"].as<String>();
      if (str == "on" || str == "HIGH" || str == "1")
        val = HIGH;
      else
        val = LOW;
    } else {
      int numeric = doc["value"].as<int>();
      val = (numeric != 0) ? HIGH : LOW;
    }
    pinMode(pin, OUTPUT);
    digitalWrite(pin, val);
    StaticJsonDocument<200> response;
    response["msg"] = "Digital write executed";
    if (msgId.length() > 0)
      response["id"] = msgId;
    String resp;
    serializeJson(response, resp);
    if (client) client->send(resp); else Serial.println(resp);
  }
  else if (doc["cmd"] == "pwm_write") {
    int pin = doc["pin"].as<int>();
    int pwmValue = doc["value"].as<int>();
    pinMode(pin, OUTPUT);
    analogWrite(pin, pwmValue);
    StaticJsonDocument<200> response;
    response["msg"] = "PWM write executed";
    if (msgId.length() > 0)
      response["id"] = msgId;
    String resp;
    serializeJson(response, resp);
    if (client) client->send(resp); else Serial.println(resp);
  }
  // Servo commands:
  else if (doc["cmd"] == "continuous_servo") {
    int pin = doc["pin"].as<int>();
    int speed = doc["speed"].as<int>();
    bool found = false;
    for (int i = 0; i < continuousServos.size(); i++) {
      if (continuousServos[i].pin == pin) {
        found = true;
        continuousServos[i].servo.write(speed);
        break;
      }
    }
    if (!found && continuousServos.size() < 4) {
      ServoControlEntry entry;
      entry.pin = pin;
      entry.servo.attach(pin);
      entry.servo.write(speed);
      continuousServos.push_back(entry);
    }
    StaticJsonDocument<200> response;
    response["msg"] = "Continuous servo updated";
    if (msgId.length() > 0)
      response["id"] = msgId;
    String resp;
    serializeJson(response, resp);
    if (client) client->send(resp); else Serial.println(resp);
  }
  else if (doc["cmd"] == "regular_servo") {
    int pin = doc["pin"].as<int>();
    int angle = doc["angle"].as<int>();
    bool found = false;
    for (int i = 0; i < regularServos.size(); i++) {
      if (regularServos[i].pin == pin) {
        found = true;
        regularServos[i].servo.write(angle);
        break;
      }
    }
    if (!found && regularServos.size() < 4) {
      ServoControlEntry entry;
      entry.pin = pin;
      entry.servo.attach(pin);
      entry.servo.write(angle);
      regularServos.push_back(entry);
    }
    StaticJsonDocument<200> response;
    response["msg"] = "Regular servo updated";
    if (msgId.length() > 0)
      response["id"] = msgId;
    String resp;
    serializeJson(response, resp);
    if (client) client->send(resp); else Serial.println(resp);
  }
  // Stepper commands:
  else if (doc["cmd"] == "stepper_turn") {
    int motor = doc["motor"].as<int>();
    long steps = doc["steps"].as<long>();
    int direction = doc["direction"].as<int>();
    if (motor >= 0 && motor < NUM_STEPPERS) {
      steppers[motor].remaining = steps;
      steppers[motor].direction = direction;
      steppers[motor].currentStep = 0x01; // Initialize to starting state B0001.
      steppers[motor].paused = false;
      steppers[motor].completionId = msgId;
      steppers[motor].completionReported = false;
      StaticJsonDocument<200> response;
      response["msg"] = "Stepper turning initiated";
      if (msgId.length() > 0)
        response["id"] = msgId;
      String resp;
      serializeJson(response, resp);
      if (client) client->send(resp); else Serial.println(resp);
    } else {
      StaticJsonDocument<200> response;
      response["error"] = "Invalid stepper motor index";
      if (msgId.length() > 0)
        response["id"] = msgId;
      String resp;
      serializeJson(response, resp);
      if (client) client->send(resp); else Serial.println(resp);
    }
  }
  else if (doc["cmd"] == "stepper_turn_multi") {
    if (!doc.containsKey("motors") || !doc["motors"].is<JsonArray>()) {
      StaticJsonDocument<200> response;
      response["error"] = "Missing or invalid 'motors' array";
      if (msgId.length() > 0)
        response["id"] = msgId;
      String resp;
      serializeJson(response, resp);
      if (client) client->send(resp); else Serial.println(resp);
      return;
    }
    JsonArray motorsArray = doc["motors"].as<JsonArray>();
    for (JsonObject motorCmd : motorsArray) {
      if (!motorCmd.containsKey("motor") || !motorCmd.containsKey("steps") || !motorCmd.containsKey("direction"))
        continue;
      int motor = motorCmd["motor"].as<int>();
      long steps = motorCmd["steps"].as<long>();
      int direction = motorCmd["direction"].as<int>();
      if (motor >= 0 && motor < NUM_STEPPERS) {
        steppers[motor].remaining = steps;
        steppers[motor].direction = direction;
        steppers[motor].currentStep = 0x01;
        steppers[motor].paused = false;
        if (motorCmd.containsKey("id"))
          steppers[motor].completionId = motorCmd["id"].as<String>();
        else
          steppers[motor].completionId = msgId;
        steppers[motor].completionReported = false;
      }
    }
    StaticJsonDocument<200> response;
    response["msg"] = "Stepper multi-turn initiated";
    if (msgId.length() > 0)
      response["id"] = msgId;
    String resp;
    serializeJson(response, resp);
    if (client) client->send(resp); else Serial.println(resp);
  }
  else if (doc["cmd"] == "update_settings") {
    if (doc.containsKey("version"))
      settings.version = doc["version"].as<uint8_t>();
    if (doc.containsKey("slackCalibration"))
      settings.slackCalibration = doc["slackCalibration"].as<uint8_t>();
    if (doc.containsKey("moveCalibration"))
      settings.moveCalibration = doc["moveCalibration"].as<float>();
    if (doc.containsKey("turnCalibration"))
      settings.turnCalibration = doc["turnCalibration"].as<float>();
    if (doc.containsKey("wheelDiameter"))
      settings.wheelDiameter = doc["wheelDiameter"].as<float>();
    if (doc.containsKey("wheelDistance"))
      settings.wheelDistance = doc["wheelDistance"].as<float>();
    if (doc.containsKey("wifi_ssid")) {
      String newSsid = doc["wifi_ssid"].as<String>();
      newSsid.toCharArray(settings.wifi_ssid, sizeof(settings.wifi_ssid));
      ssid = newSsid;
    }
    if (doc.containsKey("wifi_pass")) {
      String newPass = doc["wifi_pass"].as<String>();
      newPass.toCharArray(settings.wifi_pass, sizeof(settings.wifi_pass));
      password = newPass;
    }
    steps_per_mm = STEPS_PER_TURN / (PI * settings.wheelDiameter);
    steps_per_degree = ((settings.wheelDistance * PI) / 360.0) * steps_per_mm;
    
    EEPROM.begin(EEPROM_SIZE);
    EEPROM.put(0, settings);
    EEPROM.commit();
    
    StaticJsonDocument<200> response;
    response["msg"] = "Settings updated";
    response["version"] = settings.version;
    response["slackCalibration"] = settings.slackCalibration;
    response["moveCalibration"] = settings.moveCalibration;
    response["turnCalibration"] = settings.turnCalibration;
    response["wheelDiameter"] = settings.wheelDiameter;
    response["wheelDistance"] = settings.wheelDistance;
    response["wifi_ssid"] = settings.wifi_ssid;
    response["steps_per_mm"] = steps_per_mm;
    response["steps_per_degree"] = steps_per_degree;
    if (msgId.length() > 0)
      response["id"] = msgId;
    String resp;
    serializeJson(response, resp);
    if (client) client->send(resp); else Serial.println(resp);
  }
  else if (doc["cmd"] == "wifi_scan") {
    int n = WiFi.scanNetworks();
    StaticJsonDocument<500> response;
    JsonArray array = response.createNestedArray("ssids");
    for (int i = 0; i < n; i++) {
      array.add(WiFi.SSID(i));
    }
    if (msgId.length() > 0)
      response["id"] = msgId;
    String resp;
    serializeJson(response, resp);
    if (client) client->send(resp); else Serial.println(resp);
  }
  else if (doc["cmd"] == "beep") {
    int pin = doc["pin"].as<int>();
    int frequency = doc["frequency"].as<int>();
    int duration = doc["duration"].as<int>();
    pinMode(pin, OUTPUT);
    tone(pin, frequency, duration);
    StaticJsonDocument<200> response;
    response["msg"] = "Beep issued";
    if (msgId.length() > 0)
      response["id"] = msgId;
    String resp;
    serializeJson(response, resp);
    if (client) client->send(resp); else Serial.println(resp);
  }
  else {
    StaticJsonDocument<200> response;
    response["error"] = "Unknown command";
    if (msgId.length() > 0)
      response["id"] = msgId;
    String resp;
    serializeJson(response, resp);
    Serial.println("Unknown command received.");
    if (client) client->send(resp);
  }
}

// ==================
// WebSocket Callback
// ==================
void onMessage(WebsocketsClient& client, WebsocketsMessage message) {
  Serial.print("Got Message: ");
  Serial.println(message.data());
  for (auto &entry : allClients) {
    if (entry.client == &client) {
      entry.lastActivity = millis();
      break;
    }
  }
  processMessage(message.data(), &client);
}

// ==================
// Setup and Main Loop
// ==================
void setup() {
  delay(500);
  Serial.begin(115200);
  delay(1500);
  
  // First, load default settings from PROGMEM,
  // then attempt to load EEPROM settings.
  memcpy_P(&settings, &defaultSettings, sizeof(Settings));
  loadCredentialsFunc();
  
  steps_per_mm = STEPS_PER_TURN / (PI * settings.wheelDiameter);
  steps_per_degree = ((settings.wheelDistance * PI) / 360.0) * steps_per_mm;
  
  // Set WiFi credentials from settings.
  ssid = String(settings.wifi_ssid);
  password = String(settings.wifi_pass);
  
  if (ssid.length() > 0 && password.length() > 0) {
    Serial.print("Connecting to WiFi: ");
    Serial.println(ssid);
    WiFi.begin(ssid.c_str(), password.c_str());
    for (int i = 0; i < 15 && WiFi.status() != WL_CONNECTED; i++){
      Serial.print(".");
      delay(1000);
    }
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nWiFi connected");
      Serial.print("IP address: ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.println("\nFailed to connect to WiFi.");
    }
  } else {
    Serial.println("Waiting for WiFi credentials over Serial...");
  }
  
  // Initialize shift register pins for steppers.
  pinMode(SHIFT_REG_DATA, OUTPUT);
  pinMode(SHIFT_REG_CLOCK, OUTPUT);
  pinMode(SHIFT_REG_LATCH, OUTPUT);
  digitalWrite(SHIFT_REG_DATA, LOW);
  digitalWrite(SHIFT_REG_CLOCK, LOW);
  digitalWrite(SHIFT_REG_LATCH, LOW);
  
  // Initialize efficient steppers.
  for (int i = 0; i < NUM_STEPPERS; i++) {
    steppers[i].offset = i * 4;  // Motor 0 uses bits 0-3; Motor 1 uses bits 4-7.
    steppers[i].currentStep = 0x01;  // Start at B0001.
    steppers[i].remaining = 0;
    steppers[i].direction = FORWARD;
    steppers[i].paused = true;
    steppers[i].completionId = "";
    steppers[i].completionReported = true; // Mark as complete when idle.
  }
  lastGlobalOutput = 0;
  updateShiftRegister(0);
  
  server.listen(SERVER_PORT);
  Serial.print("Server listening on port ");
  Serial.println(SERVER_PORT);
  lastSuccessfulPoll = millis();
}

void loop() {
  yield(); // Feed the watchdog
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(".");
    WiFi.begin(ssid.c_str(), password.c_str());
  }
  
  if (server.available() && server.poll()) {
    Serial.println("Accepting a new client!");
    WebsocketsClient client = server.accept();
    client.onMessage(onMessage);
    ClientEntry entry;
    entry.client = new WebsocketsClient(client);
    entry.lastActivity = millis();
    entry.lastPing = millis();
    allClients.push_back(entry);
  }
  
  for (int i = allClients.size() - 1; i >= 0; i--) {
    ClientEntry &entry = allClients[i];
    entry.client->poll();
    if (millis() - entry.lastPing > CLIENT_PING_INTERVAL) {
      if (!entry.client->ping()) {
        Serial.println("Ping failed. Removing client.");
        entry.client->close();
        delete entry.client;
        allClients.erase(allClients.begin() + i);
        continue;
      } else {
        entry.lastPing = millis();
      }
    }
    if (millis() - entry.lastActivity > CLIENT_TIMEOUT) {
      Serial.println("Client timed out due to inactivity. Removing client.");
      entry.client->close();
      delete entry.client;
      allClients.erase(allClients.begin() + i);
    }
  }
  
  if (Serial.available()) {
    Serial.println("Serial data detected!");
    String input = Serial.readStringUntil('\n');
    input.trim();
    Serial.print("Final input received: ");
    Serial.println(input);
    if (input.length() > 0)
      processMessage(input, nullptr);
    else
      Serial.println("Warning: Received empty input.");
  }
  
  unsigned long now = micros();
  if (now - lastStepperUpdate >= stepInterval) {
    lastStepperUpdate = now;
    updateSteppers();
  }
  
  if (millis() - lastSuccessfulPoll > SERVER_POLL_TIMEOUT) {
    Serial.println("Server poll timeout exceeded. Restarting...");
    ESP.restart();
  } else {
    lastSuccessfulPoll = millis();
  }
  
  delay(100); // Short delay to reduce CPU load.
}
