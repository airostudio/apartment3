/**
 * TrendAccom - iCal Sync
 * Handles: iCal feed import/export for Booking.com, Airbnb, VRBO,
 * Google Calendar, and other iCal-compatible services
 *
 * iCal (RFC 5545) format is the industry standard for calendar sync
 * between booking platforms.
 */

(function() {
  'use strict';

  const iCalSync = {
    // Supported platforms with their iCal specifics
    platforms: {
      airbnb: {
        name: 'Airbnb',
        color: '#ff5a5f',
        icon: 'A',
        importUrlPattern: /airbnb\.com\/calendar\/ical/,
        exportFormat: 'standard'
      },
      booking: {
        name: 'Booking.com',
        color: '#003580',
        icon: 'B',
        importUrlPattern: /admin\.booking\.com/,
        exportFormat: 'standard'
      },
      vrbo: {
        name: 'VRBO',
        color: '#3b5cad',
        icon: 'V',
        importUrlPattern: /vrbo\.com/,
        exportFormat: 'standard'
      },
      google: {
        name: 'Google Calendar',
        color: '#4285f4',
        icon: 'G',
        importUrlPattern: /calendar\.google\.com/,
        exportFormat: 'standard'
      }
    },

    /**
     * Generate an iCal export URL for a property
     */
    getExportUrl(propertyId) {
      const baseUrl = window.location.origin || 'https://app.trendaccom.com';
      return `${baseUrl}/ical/export/${propertyId}.ics`;
    },

    /**
     * Generate iCal content (VCALENDAR) from bookings
     */
    generateICal(propertyName, bookings) {
      const now = new Date();
      const timestamp = this.formatICalDate(now);

      let ical = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//TrendAccom//Booking Calendar//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${propertyName} - TrendAccom`,
        `X-WR-TIMEZONE:Australia/Sydney`,
      ];

      bookings.forEach(booking => {
        const checkin = new Date(booking.checkin);
        const checkout = new Date(booking.checkout);

        ical.push(
          'BEGIN:VEVENT',
          `DTSTART;VALUE=DATE:${this.formatICalDateOnly(checkin)}`,
          `DTEND;VALUE=DATE:${this.formatICalDateOnly(checkout)}`,
          `DTSTAMP:${timestamp}`,
          `UID:${booking.id}@trendaccom.com`,
          `SUMMARY:${booking.status === 'blocked' ? 'Blocked' : booking.guestName || 'Reserved'}`,
          `DESCRIPTION:Booking ref: ${booking.reference || 'N/A'}`,
          `STATUS:CONFIRMED`,
          `TRANSP:OPAQUE`,
          'END:VEVENT'
        );
      });

      ical.push('END:VCALENDAR');
      return ical.join('\r\n');
    },

    /**
     * Parse iCal content from external platforms
     */
    parseICal(icalContent) {
      const events = [];
      const lines = icalContent.replace(/\r\n /g, '').split(/\r?\n/);

      let currentEvent = null;

      for (const line of lines) {
        if (line === 'BEGIN:VEVENT') {
          currentEvent = {};
        } else if (line === 'END:VEVENT' && currentEvent) {
          events.push({
            start: currentEvent.dtstart || null,
            end: currentEvent.dtend || null,
            summary: currentEvent.summary || 'Reserved',
            uid: currentEvent.uid || null,
            status: currentEvent.status || 'confirmed',
            description: currentEvent.description || ''
          });
          currentEvent = null;
        } else if (currentEvent) {
          const colonIdx = line.indexOf(':');
          if (colonIdx === -1) continue;

          const key = line.substring(0, colonIdx).split(';')[0].toLowerCase();
          const value = line.substring(colonIdx + 1);

          switch (key) {
            case 'dtstart':
              currentEvent.dtstart = this.parseICalDate(value);
              break;
            case 'dtend':
              currentEvent.dtend = this.parseICalDate(value);
              break;
            case 'summary':
              currentEvent.summary = value;
              break;
            case 'uid':
              currentEvent.uid = value;
              break;
            case 'status':
              currentEvent.status = value.toLowerCase();
              break;
            case 'description':
              currentEvent.description = value;
              break;
          }
        }
      }

      return events;
    },

    /**
     * Format date for iCal (with time)
     */
    formatICalDate(date) {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    },

    /**
     * Format date-only for iCal (YYYYMMDD)
     */
    formatICalDateOnly(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    },

    /**
     * Parse iCal date string
     */
    parseICalDate(dateStr) {
      // Handle YYYYMMDD format
      if (dateStr.length === 8) {
        return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      }
      // Handle YYYYMMDDTHHmmssZ format
      const cleaned = dateStr.replace(/[TZ]/g, '');
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    },

    /**
     * Detect platform from URL
     */
    detectPlatform(url) {
      for (const [key, platform] of Object.entries(this.platforms)) {
        if (platform.importUrlPattern.test(url)) {
          return key;
        }
      }
      return 'other';
    },

    /**
     * Validate iCal URL
     */
    validateUrl(url) {
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
        }
        return { valid: true };
      } catch {
        return { valid: false, error: 'Please enter a valid URL' };
      }
    },

    /**
     * Import iCal feed (simulation - in production would call server)
     */
    async importFeed(url, propertyId) {
      const validation = this.validateUrl(url);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const platform = this.detectPlatform(url);

      // In production, this would:
      // 1. Send the URL to your server
      // 2. Server fetches the iCal feed (CORS prevents direct browser fetch)
      // 3. Server parses events and blocks dates in your system
      // 4. Server sets up periodic sync (every 15-60 minutes)

      console.log('iCal import:', { url, propertyId, platform });

      return {
        success: true,
        platform: platform,
        eventsImported: 12,
        dateRange: {
          from: '2026-02-01',
          to: '2026-12-31'
        }
      };
    },

    /**
     * Trigger manual sync
     */
    async syncNow(connectionId) {
      console.log('Manual sync triggered for connection:', connectionId);

      // Simulate sync
      return {
        success: true,
        eventsImported: 3,
        eventsExported: 5,
        lastSync: new Date().toISOString()
      };
    },

    /**
     * Download iCal file
     */
    downloadICal(propertyName, bookings) {
      const content = this.generateICal(propertyName, bookings);
      const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${propertyName.replace(/\s+/g, '-').toLowerCase()}-calendar.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },

    /**
     * Copy export URL to clipboard
     */
    async copyExportUrl(propertyId) {
      const url = this.getExportUrl(propertyId);
      try {
        await navigator.clipboard.writeText(url);
        window.TrendAccom?.showToast('Export URL copied to clipboard', 'success');
      } catch {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        window.TrendAccom?.showToast('Export URL copied to clipboard', 'success');
      }
    }
  };

  // ============================================
  // iCal Admin UI Handler
  // ============================================
  function initICalAdmin() {
    // Add Feed button
    const addFeedBtn = document.getElementById('addFeedBtn');
    if (addFeedBtn) {
      addFeedBtn.addEventListener('click', async () => {
        const urlInput = document.getElementById('icalImportUrl');
        const propertySelect = document.getElementById('icalProperty');

        if (!urlInput?.value) {
          window.TrendAccom?.showToast('Please enter an iCal URL', 'warning');
          return;
        }

        try {
          const result = await iCalSync.importFeed(
            urlInput.value,
            propertySelect?.value || 'default'
          );

          if (result.success) {
            window.TrendAccom?.showToast(
              `Successfully imported ${result.eventsImported} events from ${iCalSync.platforms[result.platform]?.name || 'calendar'}`,
              'success'
            );
            urlInput.value = '';
          }
        } catch (error) {
          window.TrendAccom?.showToast(error.message, 'error');
        }
      });
    }

    // Copy export URL buttons
    document.querySelectorAll('[data-copy-export]').forEach(btn => {
      btn.addEventListener('click', () => {
        const propertyId = btn.dataset.copyExport;
        iCalSync.copyExportUrl(propertyId);
      });
    });

    // Sync Now buttons
    document.querySelectorAll('[data-sync-now]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const connectionId = btn.dataset.syncNow;
        btn.disabled = true;
        btn.textContent = 'Syncing...';

        try {
          const result = await iCalSync.syncNow(connectionId);
          if (result.success) {
            window.TrendAccom?.showToast('Sync completed successfully', 'success');
          }
        } catch (error) {
          window.TrendAccom?.showToast('Sync failed: ' + error.message, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Sync Now';
        }
      });
    });

    // Remove connection buttons
    document.querySelectorAll('[data-remove-connection]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Are you sure you want to remove this calendar connection?')) {
          const connectionId = btn.dataset.removeConnection;
          console.log('Removing connection:', connectionId);
          window.TrendAccom?.showToast('Calendar connection removed', 'info');
          btn.closest('.ical-connection')?.remove();
        }
      });
    });
  }

  // ============================================
  // Initialize
  // ============================================
  function init() {
    initICalAdmin();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.TrendAccom = window.TrendAccom || {};
  window.TrendAccom.iCalSync = iCalSync;
})();
