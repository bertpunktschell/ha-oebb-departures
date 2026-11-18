/**
 * ÖBB Departures Card — custom card for Home Assistant
 * Renders departures from a sensor in HAFAS widget style.
 *
 * Config options:
 *   entity:        sensor entity id (default: sensor.obb_krummnussbaum_abfahrten)
 *   header_color:  hex/rgb color for header bar (default: rgb(0, 96, 240))
 *   max_entries:   number of departures to show (default: 12)
 *   show_header_row: show column headers Zeit/Zug/Richtung/Bst (default: true)
 */

class OebbDeparturesCard extends HTMLElement {
  setConfig(config) {
    this.config = config;
    this.entity = config.entity || 'sensor.obb_krummnussbaum_abfahrten';
    this.headerColor = config.header_color || 'rgb(0, 96, 240)';
    this.maxEntries = config.max_entries || 12;
    this.showHeaderRow = config.show_header_row !== false;
  }

  set hass(hass) {
    this._hass = hass;
    this.render();
  }

  render() {
    if (!this._hass) return;

    const state = this._hass.states[this.entity];
    if (!state) {
      this.innerHTML = '<div style="padding:16px;color:#888;">Sensor nicht gefunden: ' + this.entity + '</div>';
      return;
    }

    const attrs = state.attributes || {};
    const deps = (attrs.departures || []).slice(0, this.maxEntries);
    const station = attrs.station || 'Krummnußbaum';
    const lastUpdated = attrs.last_updated || '';

    let rowsHtml = '';

    if (deps.length === 0) {
      rowsHtml = '<div class="oebb-empty">Keine Abfahrten verfügbar</div>';
    } else {
      for (const d of deps) {
        const cancelClass = d.cancelled ? ' cancelled' : '';

        // Delay time: show realtime in small red below scheduled, or green if on time
        let timeHtml = `<div class="oebb-time-scheduled">${d.time || ''}</div>`;
        if (d.realtime && d.realtime !== d.time) {
          if (d.delay_minutes > 0) {
            timeHtml += `<div class="oebb-time-realtime late">${d.realtime}</div>`;
          } else {
            timeHtml += `<div class="oebb-time-realtime onTime">${d.realtime}</div>`;
          }
        } else if (d.delay_minutes === 0) {
          timeHtml += `<div class="oebb-time-realtime onTime">${d.time || ''}</div>`;
        }

        // Delay badge
        let delayBadge = '';
        if (d.delay_minutes > 0) {
          delayBadge = `<span class="oebb-delay-badge late">+${d.delay_minutes}</span>`;
        } else if (d.delay_minutes === 0) {
          delayBadge = `<span class="oebb-delay-badge onTime">✓</span>`;
        }

        const bg = d.color_bg || 'rgb(0,96,240)';
        const cancelHtml = d.cancelled ? ' <span class="oebb-cancel">Ausfall</span>' : '';

        rowsHtml += `
          <li class="oebb-row${cancelClass}">
            <div class="oebb-col-time">${timeHtml}</div>
            <div class="oebb-col-delay">${delayBadge}</div>
            <div class="oebb-col-train"><span class="oebb-train-badge" style="background:${bg}">${d.train || ''}</span></div>
            <div class="oebb-col-direction">${d.direction || ''}${cancelHtml}</div>
            <div class="oebb-col-platform">Bst ${d.platform || ''}</div>
          </li>
        `;
      }
    }

    let headerRowHtml = '';
    if (this.showHeaderRow) {
      headerRowHtml = `
        <li class="oebb-header-row">
          <div class="oebb-col-time">Zeit</div>
          <div class="oebb-col-delay"></div>
          <div class="oebb-col-train">Zug</div>
          <div class="oebb-col-direction">Richtung</div>
          <div class="oebb-col-platform">Bst</div>
        </li>
      `;
    }

    this.innerHTML = `
      <style>
        .oebb-card-wrap {
          background: var(--card-background-color, #fff);
          border-radius: var(--ha-card-border-radius, 12px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          overflow: hidden;
          font-family: var(--paper-font-body1_-_font-family), -apple-system, sans-serif;
        }
        .oebb-top-bar {
          background: ${this.headerColor};
          color: #fff;
          padding: 14px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .oebb-top-bar-title {
          font-weight: 600;
          font-size: 16px;
        }
        .oebb-top-bar-time {
          font-size: 11px;
          font-weight: 400;
          opacity: 0.8;
        }
        .oebb-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .oebb-header-row {
          display: flex;
          align-items: center;
          padding: 6px 16px;
          border-bottom: 2px solid var(--divider-color, #e0e0e0);
          font-size: 11px;
          font-weight: 600;
          color: var(--secondary-text-color, #888);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .oebb-row {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          border-bottom: 1px solid var(--divider-color, #e0e0e0);
        }
        .oebb-row:last-child {
          border-bottom: none;
        }
        .oebb-row.cancelled {
          opacity: 0.5;
        }
        .oebb-col-time {
          min-width: 52px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .oebb-time-scheduled {
          font-weight: 700;
          font-size: 17px;
          color: var(--primary-text-color, #333);
          line-height: 1.2;
        }
        .oebb-time-realtime {
          font-size: 11px;
          font-weight: 600;
          line-height: 1.2;
        }
        .oebb-time-realtime.late { color: #d32f2f; }
        .oebb-time-realtime.onTime { color: #4caf50; }
        .oebb-col-delay {
          min-width: 30px;
          text-align: center;
        }
        .oebb-delay-badge {
          font-size: 12px;
          font-weight: 600;
        }
        .oebb-delay-badge.late { color: #d32f2f; }
        .oebb-delay-badge.onTime { color: #4caf50; }
        .oebb-col-train {
          min-width: 58px;
          margin-left: 6px;
        }
        .oebb-train-badge {
          display: inline-block;
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 4px;
          white-space: nowrap;
        }
        .oebb-col-direction {
          flex: 1;
          margin-left: 8px;
          font-size: 13px;
          color: var(--primary-text-color, #333);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .oebb-cancel {
          color: #d32f2f;
          font-weight: 600;
        }
        .oebb-col-platform {
          min-width: 44px;
          text-align: right;
          font-size: 12px;
          color: var(--secondary-text-color, #888);
          font-weight: 500;
          white-space: nowrap;
        }
        .oebb-empty {
          padding: 24px 16px;
          text-align: center;
          color: var(--secondary-text-color, #888);
        }
      </style>
      <div class="oebb-card-wrap">
        <div class="oebb-top-bar">
          <span class="oebb-top-bar-title">🚂 ${station}</span>
          <span class="oebb-top-bar-time">${lastUpdated}</span>
        </div>
        <ul class="oebb-list">
          ${headerRowHtml}
          ${rowsHtml}
        </ul>
      </div>
    `;
  }

  getCardSize() {
    return 3;
  }

  static getStubConfig() {
    return {
      entity: 'sensor.obb_krummnussbaum_abfahrten',
      header_color: 'rgb(0, 96, 240)',
      max_entries: 12,
      show_header_row: true
    };
  }
}

customElements.define('oebb-departures-card', OebbDeparturesCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'oebb-departures-card',
  name: 'ÖBB Departures Card',
  description: 'Displays ÖBB departures in HAFAS widget style',
});
