#include <WiFi.h>
#include <HTTPClient.h>
#include "config.h"

// =========================
// 배터리 변수
// =========================
float voltage = 0;
float percent = 0;
float prevVoltage = 0;
float smoothPercent = 0;

bool chargingStarted = false;
unsigned long chargeStartTime = 0;

float startPercent = 0;
bool firstRun = true;
bool batteryReconnected = false;

// =========================
// 실제 측정 기준값
// =========================
int FULL_RAW = 2600;
int EMPTY_RAW = 1900;

// =========================
// 80% 제한 모드
// =========================
bool limit80Mode = true;

// =========================
// 충전 상태 및 제어 변수
// =========================
String chargeStatus = "DISCONNECTED";
String lastSentStatus = "";
int chargeDetectionCount = 0;

// =========================
// ESP32 ADC 핀
// =========================
int analogPin = 34;

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi 연결 중");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi 연결 완료!");
}

// =========================
// setup
// =========================
void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  connectWiFi();
}

// =========================
// loop
// =========================
void loop() {
  long sum = 0;
  for (int i = 0; i < 30; i++) {
    sum += analogRead(analogPin);
    delay(10);
  }
  int avgRaw = sum / 30;

  // =========================
  // 1. 배터리 미연결 감지
  // =========================
  if (avgRaw < 1500 || avgRaw > 3000) {
    voltage = 0;
    smoothPercent = 0;
    percent = 0;

    if (lastSentStatus != "DISCONNECTED") {
      Serial.println("\n🔌 배터리 물리적 연결 해제 감지 -> DISCONNECTED 전송");
      sendData(0, 0, "DISCONNECTED");
      lastSentStatus = "DISCONNECTED";
    }

    chargeStatus = "DISCONNECTED";
    chargingStarted = false;
    batteryReconnected = true;
    chargeDetectionCount = 0;

    delay(1000);
    return;
  }

  // =========================
  // 전압 및 퍼센트 계산
  // =========================
  voltage = avgRaw * (3.3 / 4095.0) * 2;
  percent = (float)(avgRaw - EMPTY_RAW) / (FULL_RAW - EMPTY_RAW) * 100.0;
  percent = constrain(percent, 0, 100);

  if (firstRun) {
    smoothPercent = percent;
    prevVoltage = voltage;
    firstRun = false;
  }
  if (batteryReconnected) {
    smoothPercent = percent;
    batteryReconnected = false;
  }

  // =========================
  // 충전 및 탈착 감지 로직
  // =========================
  String currentLoopStatus = "CONNECTED";

  // A. 충전 시작 감지
  if (voltage > prevVoltage + 0.02) {
    chargeDetectionCount++;
    if (chargeDetectionCount >= 3) {
      chargingStarted = true;
      chargeDetectionCount = 0;
    }
  }
  // B. 충전기 분리 감지
  else if (voltage < prevVoltage - 0.04) {
    if (chargingStarted) {
      Serial.println("\n🔻 충전 중 전압 강하 감지 -> 즉시 DISCONNECTED 전송");
      sendData(voltage, smoothPercent, "DISCONNECTED");
      chargingStarted = false;
      lastSentStatus = "DISCONNECTED";
    }
    chargeDetectionCount = 0;
  }
  // C. 안정화 시 카운터 리셋
  else if (abs(voltage - prevVoltage) < 0.01) {
    chargeDetectionCount = 0;
  }

  if (chargingStarted) {
    currentLoopStatus = "CHARGING";

    if (limit80Mode && smoothPercent >= 80) {
      currentLoopStatus = "CONNECTED";
      chargingStarted = false;
      Serial.println("🛡️ 80% 충전 보호 작동");
    }
  } else {
    currentLoopStatus = "CONNECTED";
  }

  chargeStatus = currentLoopStatus;

  if (chargingStarted) {
    if (percent > smoothPercent + 1) percent = smoothPercent + 1;
    if (percent < smoothPercent) percent = smoothPercent;
    smoothPercent = (percent * 0.10) + (smoothPercent * 0.90);
  } else {
    smoothPercent = (percent * 0.2) + (smoothPercent * 0.8);
  }

  // =========================
  // 서버 주기적 전송
  // =========================
  if (chargeStatus != "DISCONNECTED" || lastSentStatus != "DISCONNECTED") {
    sendData(voltage, smoothPercent, chargeStatus);
    lastSentStatus = chargeStatus;
  }

  Serial.print("V: "); Serial.print(voltage);
  Serial.print(" | Bat: "); Serial.print((int)smoothPercent);
  Serial.print("% | Status: "); Serial.println(chargeStatus);

  prevVoltage = voltage;
  delay(3000);
}

void sendData(float v, float p, String status) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(CONNECTOR_SERVER_URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("ngrok-skip-browser-warning", "69420");

    String json = "{";
    json += "\"charger_id\":\"" + String(CHARGER_ID) + "\",";
    json += "\"status\":\"" + status + "\",";
    json += "\"voltage\":" + String(v) + ",";
    json += "\"battery\":" + String((int)p) + ",";
    json += "\"user_id\":null,";
    json += "\"is_guest\":false";
    json += "}";

    int httpResponseCode = http.POST(json);
    Serial.print("HTTP Response: ");
    Serial.println(httpResponseCode);
    http.end();
  }
}
