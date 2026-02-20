/**
 * TrendAccom - Calendar Widget
 * Handles: Availability calendar rendering, date range selection,
 * booking visualization, and admin calendar management
 */

(function() {
  'use strict';

  class AvailabilityCalendar {
    constructor(container, options = {}) {
      this.container = typeof container === 'string'
        ? document.querySelector(container)
        : container;

      if (!this.container) return;

      this.options = {
        mode: options.mode || 'select', // 'select', 'display', 'admin'
        minDate: options.minDate || new Date(),
        maxDate: options.maxDate || null,
        minStay: options.minStay || 1,
        maxStay: options.maxStay || 30,
        bookedDates: options.bookedDates || [],
        blockedDates: options.blockedDates || [],
        bookings: options.bookings || [], // For admin view
        onSelect: options.onSelect || null,
        onRangeSelect: options.onRangeSelect || null,
        showLegend: options.showLegend !== false,
        monthsToShow: options.monthsToShow || 1,
      };

      this.currentMonth = new Date();
      this.currentMonth.setDate(1);
      this.selectedStart = null;
      this.selectedEnd = null;
      this.hoverDate = null;

      this.render();
      this.attachEvents();
    }

    render() {
      this.container.innerHTML = '';
      this.container.classList.add('availability-calendar');

      for (let m = 0; m < this.options.monthsToShow; m++) {
        const monthDate = new Date(this.currentMonth);
        monthDate.setMonth(monthDate.getMonth() + m);
        this.container.appendChild(this.renderMonth(monthDate));
      }

      if (this.options.showLegend) {
        this.container.appendChild(this.renderLegend());
      }
    }

    renderMonth(date) {
      const month = document.createElement('div');
      month.className = 'calendar-month';

      // Header
      const header = document.createElement('div');
      header.className = 'calendar-header';
      header.innerHTML = `
        <button class="calendar-nav-btn" data-action="prev">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h3>${date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</h3>
        <button class="calendar-nav-btn" data-action="next">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      `;
      month.appendChild(header);

      // Weekdays
      const weekdays = document.createElement('div');
      weekdays.className = 'calendar-weekdays';
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(day => {
        const span = document.createElement('span');
        span.textContent = day;
        weekdays.appendChild(span);
      });
      month.appendChild(weekdays);

      // Days grid
      const grid = document.createElement('div');
      grid.className = 'calendar-grid';

      const year = date.getFullYear();
      const monthIdx = date.getMonth();
      const firstDay = new Date(year, monthIdx, 1);
      const lastDay = new Date(year, monthIdx + 1, 0);

      // Get Monday-based day of week (0 = Mon, 6 = Sun)
      let startDayOfWeek = firstDay.getDay() - 1;
      if (startDayOfWeek < 0) startDayOfWeek = 6;

      // Previous month padding
      for (let i = 0; i < startDayOfWeek; i++) {
        const prevDate = new Date(year, monthIdx, -startDayOfWeek + i + 1);
        grid.appendChild(this.renderDay(prevDate, true));
      }

      // Current month days
      for (let d = 1; d <= lastDay.getDate(); d++) {
        const dayDate = new Date(year, monthIdx, d);
        grid.appendChild(this.renderDay(dayDate, false));
      }

      // Next month padding
      const totalCells = startDayOfWeek + lastDay.getDate();
      const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
      for (let i = 1; i <= remaining; i++) {
        const nextDate = new Date(year, monthIdx + 1, i);
        grid.appendChild(this.renderDay(nextDate, true));
      }

      month.appendChild(grid);
      return month;
    }

    renderDay(date, isOtherMonth) {
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day';
      dayEl.dataset.date = date.toISOString().split('T')[0];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dateStr = date.toISOString().split('T')[0];

      if (isOtherMonth) {
        dayEl.classList.add('calendar-day--other-month');
      }

      if (date.toDateString() === today.toDateString()) {
        dayEl.classList.add('calendar-day--today');
      }

      // Check if booked
      if (this.options.bookedDates.includes(dateStr)) {
        dayEl.classList.add('calendar-day--unavailable');
      }

      // Check if blocked
      if (this.options.blockedDates.includes(dateStr)) {
        dayEl.classList.add('calendar-day--blocked');
      }

      // Check if before min date
      if (date < this.options.minDate) {
        dayEl.classList.add('calendar-day--unavailable');
      }

      // Selected state
      if (this.selectedStart && dateStr === this.selectedStart.toISOString().split('T')[0]) {
        dayEl.classList.add('calendar-day--selected');
      }
      if (this.selectedEnd && dateStr === this.selectedEnd.toISOString().split('T')[0]) {
        dayEl.classList.add('calendar-day--selected');
      }

      // Range state
      if (this.selectedStart && this.selectedEnd) {
        if (date > this.selectedStart && date < this.selectedEnd) {
          dayEl.classList.add('calendar-day--range');
        }
      }

      // Admin mode: show bookings
      if (this.options.mode === 'admin') {
        const dayContent = document.createElement('div');
        dayContent.style.width = '100%';
        const dayNum = document.createElement('div');
        dayNum.className = 'day-number';
        dayNum.textContent = date.getDate();
        dayContent.appendChild(dayNum);

        this.options.bookings.forEach(booking => {
          const bookingStart = new Date(booking.checkin);
          const bookingEnd = new Date(booking.checkout);
          if (date >= bookingStart && date < bookingEnd) {
            const bookingEl = document.createElement('div');
            bookingEl.className = `day-booking day-booking--${booking.status}`;
            bookingEl.textContent = booking.guestName;
            bookingEl.title = `${booking.guestName}: ${booking.checkin} - ${booking.checkout}`;
            dayContent.appendChild(bookingEl);
          }
        });

        dayEl.appendChild(dayContent);
      } else {
        dayEl.textContent = date.getDate();
      }

      return dayEl;
    }

    renderLegend() {
      const legend = document.createElement('div');
      legend.className = 'calendar-legend';
      legend.innerHTML = `
        <div class="legend-item"><div class="legend-dot legend-dot--available"></div> Available</div>
        <div class="legend-item"><div class="legend-dot legend-dot--booked"></div> Booked</div>
        <div class="legend-item"><div class="legend-dot legend-dot--blocked"></div> Blocked</div>
      `;
      return legend;
    }

    attachEvents() {
      // Navigation
      this.container.addEventListener('click', (e) => {
        const navBtn = e.target.closest('[data-action]');
        if (navBtn) {
          const action = navBtn.dataset.action;
          if (action === 'prev') this.prevMonth();
          if (action === 'next') this.nextMonth();
          return;
        }

        // Day selection
        const dayEl = e.target.closest('.calendar-day');
        if (dayEl && !dayEl.classList.contains('calendar-day--unavailable') &&
            !dayEl.classList.contains('calendar-day--blocked') &&
            !dayEl.classList.contains('calendar-day--other-month')) {
          this.handleDayClick(new Date(dayEl.dataset.date));
        }
      });

      // Hover for range preview
      if (this.options.mode === 'select') {
        this.container.addEventListener('mouseover', (e) => {
          const dayEl = e.target.closest('.calendar-day');
          if (dayEl && this.selectedStart && !this.selectedEnd) {
            this.hoverDate = new Date(dayEl.dataset.date);
            this.updateHoverRange();
          }
        });
      }
    }

    handleDayClick(date) {
      if (this.options.mode === 'select') {
        if (!this.selectedStart || this.selectedEnd) {
          // Start new selection
          this.selectedStart = date;
          this.selectedEnd = null;
        } else {
          // Complete selection
          if (date > this.selectedStart) {
            this.selectedEnd = date;
            if (this.options.onRangeSelect) {
              this.options.onRangeSelect(this.selectedStart, this.selectedEnd);
            }
          } else {
            this.selectedStart = date;
          }
        }
      } else if (this.options.onSelect) {
        this.options.onSelect(date);
      }

      this.render();
      this.attachEvents();
    }

    updateHoverRange() {
      this.container.querySelectorAll('.calendar-day').forEach(dayEl => {
        dayEl.classList.remove('calendar-day--range');
        const dayDate = new Date(dayEl.dataset.date);
        if (this.selectedStart && this.hoverDate &&
            dayDate > this.selectedStart && dayDate <= this.hoverDate) {
          dayEl.classList.add('calendar-day--range');
        }
      });
    }

    prevMonth() {
      this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
      this.render();
      this.attachEvents();
    }

    nextMonth() {
      this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
      this.render();
      this.attachEvents();
    }

    setBookedDates(dates) {
      this.options.bookedDates = dates;
      this.render();
      this.attachEvents();
    }

    setBlockedDates(dates) {
      this.options.blockedDates = dates;
      this.render();
      this.attachEvents();
    }

    getSelectedRange() {
      return {
        start: this.selectedStart,
        end: this.selectedEnd
      };
    }
  }

  // Expose globally
  window.TrendAccom = window.TrendAccom || {};
  window.TrendAccom.AvailabilityCalendar = AvailabilityCalendar;

  // Auto-init calendars with data attributes
  function initCalendars() {
    document.querySelectorAll('[data-calendar]').forEach(el => {
      const mode = el.dataset.calendarMode || 'display';
      new AvailabilityCalendar(el, { mode });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCalendars);
  } else {
    initCalendars();
  }
})();
