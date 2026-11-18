#!/usr/bin/env python3
"""
ÖBB Departure fetcher for Home Assistant command_line sensor.
Place this file in /config/www/oebb_fetch.py inside the HA container.

Usage in configuration.yaml:
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

Output: JSON with departures array on stdout, errors on stderr.
"""

import json
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

STATION_LID = "A=1@O=Krummnußbaum an der Westbahn@X=15158878@Y=48207971@U=81@L=1131517@p=1789035544@"
STATION_NAME = "Krummnußbaum an der Westbahn"
MAX_JNY = 12
HAFAS_URL = "https://fahrplan.oebb.at/bin/mgate.exe"
AID = "OWDL4fE4ixNiPBBm"
PROD_FILTER = 63

TZ = timezone(timedelta(hours=1))


def fmt_time(t):
    if not t or len(t) < 4:
        return t
    return f"{t[:2]}:{t[2:4]}"


def fetch():
    now = datetime.now(TZ)
    payload = {
        "auth": {"type": "AID", "aid": AID},
        "client": {"type": "WEB", "id": "OEBB", "name": "webapp", "os": "Linux"},
        "ver": "1.46",
        "lang": "de",
        "formatted": True,
        "svcReqL": [{
            "meth": "StationBoard",
            "req": {
                "type": "DEP",
                "date": now.strftime("%Y%m%d"),
                "time": now.strftime("%H%M%S"),
                "stbLoc": {"type": "S", "lid": STATION_LID},
                "maxJny": MAX_JNY,
                "jnyFltrL": [{"type": "PROD", "mode": "INC", "value": PROD_FILTER}]
            }
        }]
    }

    req = urllib.request.Request(
        HAFAS_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return None

    svc = data.get("svcResL", [{}])[0]
    if svc.get("err") != "OK":
        print(f"HAFAS error: {svc.get('err')}", file=sys.stderr)
        return None

    res = svc.get("res", {})
    common = res.get("common", {})
    remL = common.get("remL", [])
    prodL = common.get("prodL", [])
    icoL = common.get("icoL", [])

    deps = []
    for jny in res.get("jnyL", []):
        stop = jny.get("stbStop", {})
        prod = prodL[jny["prodX"]] if "prodX" in jny and jny["prodX"] < len(prodL) else {}

        time_s = stop.get("dTimeS", "")
        time_r = stop.get("dTimeR", "")
        pltf = stop.get("dPltfR", {}).get("txt", "") or stop.get("dPltfS", {}).get("txt", "")
        delay_txt = stop.get("dTimeFR", {}).get("txtA", "")
        cancelled = jny.get("isCncl", False)
        train = prod.get("nameS", prod.get("name", ""))
        cat = prod.get("prodCtx", {}).get("catOutS", "").strip()
        direction = jny.get("dirTxt", "")

        icoX = prod.get("icoX", -1)
        ico = icoL[icoX] if icoX >= 0 and icoX < len(icoL) else {}
        bg = ico.get("bg", {})

        features = []
        for msg in jny.get("msgL", []):
            if msg.get("type") == "REM":
                idx = msg.get("remX", -1)
                if 0 <= idx < len(remL):
                    txt = remL[idx].get("txtN", remL[idx].get("txt", ""))
                    if txt:
                        features.append(txt)

        delay_min = None
        if time_s and time_r:
            try:
                s_h, s_m = int(time_s[:2]), int(time_s[2:4])
                r_h, r_m = int(time_r[:2]), int(time_r[2:4])
                delay_min = (r_h * 60 + r_m) - (s_h * 60 + s_m)
            except (ValueError, IndexError):
                pass

        mins_until = None
        if time_s:
            try:
                dh, dm = int(time_s[:2]), int(time_s[2:4])
                mins_until = (dh * 60 + dm) - (now.hour * 60 + now.minute)
                if mins_until < -120:
                    mins_until += 1440
            except (ValueError, IndexError):
                pass

        deps.append({
            "train": train,
            "category": cat,
            "direction": direction,
            "time": fmt_time(time_s),
            "realtime": fmt_time(time_r),
            "delay_minutes": delay_min,
            "delay_text": delay_txt,
            "platform": pltf,
            "cancelled": cancelled,
            "color_bg": f"rgb({bg.get('r',0)},{bg.get('g',0)},{bg.get('b',0)})" if bg else "rgb(0,96,240)",
            "features": features,
            "minutes_until": mins_until,
        })

    return {
        "station": STATION_NAME,
        "last_updated": now.strftime("%H:%M:%S"),
        "departures": deps,
    }


result = fetch()
if result is None:
    # Output stale/empty data instead of failing
    result = {
        "station": STATION_NAME,
        "last_updated": datetime.now(TZ).strftime("%H:%M:%S"),
        "departures": [],
        "error": "fetch_failed",
    }

print(json.dumps(result, ensure_ascii=False))
