// LOAD ALL LIBRARIES FIRST
#include <Arduino.h>

// DEFINE ALL PREPROCESSOR MACROS
// see pinout in datasheet to know what pins are where / do what
// NOTE: macros are defined in ALL CAPS to help identify their usage in the code (in contrast to variables)
// All device specification-related values should be defined here, *not* in the downstream code! You should
// not have to search the code for where values are defined / used.
//
// REMEMBER THAT ONLY DIGITAL OUTPUT PINS ANNOTATED WITH A ~ ON THE PINOUT DIAGRAM CAN BE USED FOR PWM

#define BLINK_PIN 7 // D7 Nose (body) LED
#define BRIGHT_PIN 5 // D5 Eyes (head) LED
#define HB_PIN 13 // D13
#define BUTTON_INTERRUPT_PIN 2 // D2 button pin
#define POT_BLINK A2 // A2 potentiometer that controls blink frequency
#define POT_BRIGHT A0 // A0 potentiometer that controls LED brightness
#define ANALOG_READ_RANGE 710.0 // max potentiometer analog value based on testing, theoretical max is 1023
#define BRIGHT_DURATION_MS 5000
#define BLINK_DURATION_MS 10000
#define HB_HALF_PERIOD_MS 500 // heartbeat toggles every 500 ms for a 1 Hz frequency
#define PWM_MAX 255 // max value for 8-bit PWM
#define NOSE_BLINK_MIN_HZ 5.0 // minimum blink frequency in Hz
#define NOSE_BLINK_MAX_HZ 10.0 // maximum blink frequency in Hz

// DEFINE ALL VARIABLES AND STRUCTS
unsigned int bright_pot_voltage_raw;
unsigned int blink_pot_voltage_raw;
float blinkfrequency;
unsigned int brightness;
unsigned long last_toggle_time_ms = 0;
unsigned long blink_end_time_ms;
unsigned long bright_end_time_ms;
unsigned long last_hb_time_ms = 0;
bool blink_on;
bool bright_on;
bool blink_led_state;
bool hb_state = true;

// DECLARE ALL FUNCTIONS (excluding loop() and setup())
void button_callback();
void read_blink_voltage();
void read_bright_voltage();
void calc_blink_bright();
void check_bright_timeout(unsigned long current_time_ms);
void update_blink(unsigned long current_time_ms);

// setup state machine enum and variable
enum states {
  IDLE_ENTRY,
  IDLE,
  IDLE_EXIT,
  READ_POTS,
  CALC_BLINK_BRIGHT,
  TOGGLE_ENTRY,
  TOGGLE_LED
};

// volatile keyword used to ensure integrity of value when manipulated by an ISR
volatile int state = IDLE_ENTRY;

// setup is run once when the device is powered on
void setup() {
  // enable digital pins
  pinMode(BLINK_PIN, OUTPUT);
  pinMode(BRIGHT_PIN, OUTPUT);
  pinMode(HB_PIN, OUTPUT);
  pinMode(BUTTON_INTERRUPT_PIN, INPUT_PULLUP); // pull pin up to HIGH if not driven by input signal

  // start the serial communication monitor
  // 9600 is the baud rate (9600 bits/s); slower is more reliable
  Serial.begin(9600);
  Serial.println("INF: Device initialized.");
}

// this loop runs continuously and switches the active state represented by
// the state variable enum value
void loop() {
  // add state-agnostic code here
  unsigned long current_time_ms = millis();
  if (current_time_ms > last_hb_time_ms + HB_HALF_PERIOD_MS) {
    // if one half heartbeat period has elapsed (500 ms)
    digitalWrite(HB_PIN, hb_state); // toggle LED
    hb_state = !hb_state; // update state variable
    last_hb_time_ms = current_time_ms; // update last toggle time
  }

  // state machine
  switch (state) {
    case IDLE_ENTRY:
      // associate an ISR with a pin event
      attachInterrupt(digitalPinToInterrupt(BUTTON_INTERRUPT_PIN), button_callback, FALLING);
      state = IDLE;
      break;

    case IDLE:
      break;

    case IDLE_EXIT:
      // disable button interrupt to prevent triggering while in the following states
      detachInterrupt(digitalPinToInterrupt(BUTTON_INTERRUPT_PIN));
      state = READ_POTS;
      break;

    case READ_POTS:
      // state where potentiometer voltages are read
      read_blink_voltage();
      read_bright_voltage();
      state = CALC_BLINK_BRIGHT;
      break;

    case CALC_BLINK_BRIGHT:
      // calculate blink frequency and brightness based on potentiometer voltages
      calc_blink_bright();
      state = TOGGLE_ENTRY;
      break;

    case TOGGLE_ENTRY:
      // get current time to track elapsed time for keeping output LEDs on
      last_toggle_time_ms = current_time_ms;
      blink_end_time_ms = current_time_ms + BLINK_DURATION_MS;
      bright_end_time_ms = current_time_ms + BRIGHT_DURATION_MS;
      blink_on = true;
      bright_on = true;
      blink_led_state = true;
      digitalWrite(BLINK_PIN, blink_led_state);
      analogWrite(BRIGHT_PIN, brightness);
      state = TOGGLE_LED;
      break;

    case TOGGLE_LED:
      // see if five seconds have elapsed and turn off eyes if so
      check_bright_timeout(current_time_ms);

      // see if ten seconds have elapsed, turn off nose, and return to idle
      if (current_time_ms > blink_end_time_ms) {
        blink_on = false;
        digitalWrite(BLINK_PIN, LOW);
        state = IDLE_ENTRY;
        break;
      }

      // if blink sequence is still on, blink nose at specified frequency
      if (blink_on) {
        update_blink(current_time_ms);
      }
      break;

    default:
      // catch-all for any unexpected state
      break;
  }
}

void button_callback() {
  /* Interrupt Service Routine (ISR)
  Code in this ISR must consume minimal resources and run quickly.
  */
  state = IDLE_EXIT;
}

void read_blink_voltage() {
  // read the blink potentiometer voltage
  blink_pot_voltage_raw = analogRead(POT_BLINK);
  Serial.print("DBG: Blink pot voltage: ");
  Serial.println(blink_pot_voltage_raw);
}

void read_bright_voltage() {
  // read the bright potentiometer voltage
  bright_pot_voltage_raw = analogRead(POT_BRIGHT);
  Serial.print("DBG: Bright pot voltage: ");
  Serial.println(bright_pot_voltage_raw);
}

void calc_blink_bright() {
  // map the 0-710 pot voltage to a 5-10 Hz blink frequency range
  blinkfrequency = ((blink_pot_voltage_raw / ANALOG_READ_RANGE) *
                    (NOSE_BLINK_MAX_HZ - NOSE_BLINK_MIN_HZ)) +
                   NOSE_BLINK_MIN_HZ;

  // map the 0-710 pot voltage to a 0-255 brightness value
  brightness = (bright_pot_voltage_raw / ANALOG_READ_RANGE) * PWM_MAX;

  Serial.print("DBG: Blink frequency (Hz): ");
  Serial.println(blinkfrequency);
  Serial.print("DBG: Brightness (0-255): ");
  Serial.println(brightness);
}

void check_bright_timeout(unsigned long current_time_ms) {
  if (current_time_ms > bright_end_time_ms) {
    // if five seconds have elapsed
    bright_on = false;
    analogWrite(BRIGHT_PIN, 0);
  }
}

void update_blink(unsigned long current_time_ms) {
  if (current_time_ms > last_toggle_time_ms + (1000.0 / blinkfrequency) / 2) {
    // if half a blink period has elapsed
    blink_led_state = !blink_led_state;
    digitalWrite(BLINK_PIN, blink_led_state);
    last_toggle_time_ms = current_time_ms;
  }
}
