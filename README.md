# ÖBB Departures Card for Home Assistant

A custom card and Python script that displays ÖBB (Austrian Railway) departures in HAFAS widget style — cached and instant instead of loading a live iframe.

## Problem

The original `custom:oebb-widget` embeds a HAFAS iframe that fetches data from `fahrplan.oebb.at` on every open. This causes a noticeable delay when opening the popup.

## Solution

1. **`oebb_fetch.py`** — A Python script that calls the HAFAS mgate API directly and outputs JSON. Runs as a `command_line` sensor in Home Assistant, updating every 60 seconds.
2. **`oebb-card.js`** — A custom Lovelace card that renders the sensor data in HAFAS widget style with proper CSS/Flexbox.

## Installation

### 1. Python Script

Copy `oebb_fetch.py` to `/config/www/oebb_fetch.py` inside the HA container (via File Editor or `docker exec`).

### 2. Sensor Configuration

Add to `configuration.yaml`:

```yaml
command_line:
  - sensor:
      name: "ÖBB Krummnußbaum Abfahrten"
      command: "python3 /config/www/oebb_fetch.py"
      scan_interval: 60
      json_attributes:
        - departures
        - last_updated
        - station
      value_template: "{{ value_json.departures | count }} Abfahrten"
```

Reload Command Line in Developer Tools → YAML, or restart HA.

### 3. Custom Card

Copy `oebb-card.js` to `/config/www/oebb-card.js`.

Register as resource in Settings → Dashboards → Resources:
- URL: `/local/oebb-card.js`
- Type: `JavaScript module`

### 4. Dashboard Config

```yaml
type: custom:oebb-departures-card
entity: sensor.obb_krummnussbaum_abfahrten
header_color: "rgb(0, 96, 240)"
max_entries: 12
show_header_row: true
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity` | string | `sensor.obb_krummnussbaum_abfahrten` | Sensor entity ID |
| `header_color` | string | `rgb(0, 96, 240)` | Header bar color (hex/rgb) |
| `max_entries` | integer | `12` | Number of departures to show |
| `show_header_row` | boolean | `true` | Show/hide column headers |

## Features

- Instant rendering (no iframe loading delay)
- Realtime delay display: scheduled time with realtime time below in red (late) or green (on time)
- Train category badges with HAFAS colors
- Cancellation display (Ausfall)
- Station name and last-updated timestamp in header
- Configurable header color, entry count, and column headers

## HAFAS API

Uses the ÖBB HAFAS mgate API (`https://fahrplan.oebb.at/bin/mgate.exe`) with:
- Station: Krummnußbaum an der Westbahn (LID: `A=1@O=Krummnußbaum...@L=1131517@`)
- Product filter: all trains (value 63)
- Max journeys: 12

To use a different station, update `STATION_LID` and `STATION_NAME` in `oebb_fetch.py`.

## Files

- `oebb_fetch.py` — Python script for HA command_line sensor
- `oebb-card.js` — Custom Lovelace card
