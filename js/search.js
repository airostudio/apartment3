/**
 * TrendAccom - Search & Filter
 * Handles: Property search, filtering, sorting, and results display
 */

(function() {
  'use strict';

  const Search = {
    filters: {
      location: '',
      checkin: '',
      checkout: '',
      guests: 2,
      types: [],
      priceMin: 0,
      priceMax: 1000,
      rating: 0,
      amenities: [],
      sortBy: 'recommended'
    },

    /**
     * Initialize search from URL parameters
     */
    init() {
      const params = new URLSearchParams(window.location.search);

      if (params.get('location')) this.filters.location = params.get('location');
      if (params.get('checkin')) this.filters.checkin = params.get('checkin');
      if (params.get('checkout')) this.filters.checkout = params.get('checkout');
      if (params.get('guests')) this.filters.guests = parseInt(params.get('guests'));
      if (params.get('type')) this.filters.types = [params.get('type')];

      this.populateFormFields();
      this.attachEvents();
      this.applyFilters();
    },

    /**
     * Populate form fields from filters
     */
    populateFormFields() {
      const locationInput = document.querySelector('[name="filter-location"], #filterLocation');
      if (locationInput) locationInput.value = this.filters.location;

      const checkinInput = document.querySelector('[name="filter-checkin"], #filterCheckin');
      if (checkinInput) checkinInput.value = this.filters.checkin;

      const checkoutInput = document.querySelector('[name="filter-checkout"], #filterCheckout');
      if (checkoutInput) checkoutInput.value = this.filters.checkout;

      const guestsInput = document.querySelector('[name="filter-guests"], #filterGuests');
      if (guestsInput) guestsInput.value = this.filters.guests;

      // Check property type checkboxes
      this.filters.types.forEach(type => {
        const checkbox = document.querySelector(`input[name="type"][value="${type}"]`);
        if (checkbox) checkbox.checked = true;
      });
    },

    /**
     * Attach event listeners
     */
    attachEvents() {
      // Type filter checkboxes
      document.querySelectorAll('input[name="type"]').forEach(cb => {
        cb.addEventListener('change', () => {
          this.filters.types = Array.from(
            document.querySelectorAll('input[name="type"]:checked')
          ).map(el => el.value);
          this.applyFilters();
        });
      });

      // Amenity filter checkboxes
      document.querySelectorAll('input[name="amenity"]').forEach(cb => {
        cb.addEventListener('change', () => {
          this.filters.amenities = Array.from(
            document.querySelectorAll('input[name="amenity"]:checked')
          ).map(el => el.value);
          this.applyFilters();
        });
      });

      // Rating filter
      document.querySelectorAll('input[name="rating"]').forEach(radio => {
        radio.addEventListener('change', () => {
          this.filters.rating = parseInt(radio.value) || 0;
          this.applyFilters();
        });
      });

      // Price range
      const priceMin = document.getElementById('priceMin');
      const priceMax = document.getElementById('priceMax');
      if (priceMin) {
        priceMin.addEventListener('input', () => {
          this.filters.priceMin = parseInt(priceMin.value);
          const label = document.getElementById('priceMinLabel');
          if (label) label.textContent = `$${this.filters.priceMin}`;
          this.applyFilters();
        });
      }
      if (priceMax) {
        priceMax.addEventListener('input', () => {
          this.filters.priceMax = parseInt(priceMax.value);
          const label = document.getElementById('priceMaxLabel');
          if (label) label.textContent = `$${this.filters.priceMax}`;
          this.applyFilters();
        });
      }

      // Sort
      const sortSelect = document.getElementById('sortBy');
      if (sortSelect) {
        sortSelect.addEventListener('change', () => {
          this.filters.sortBy = sortSelect.value;
          this.applyFilters();
        });
      }

      // Search bar re-search
      const searchBtn = document.getElementById('searchBtn');
      if (searchBtn) {
        searchBtn.addEventListener('click', () => {
          this.filters.location = document.querySelector('[name="filter-location"]')?.value || '';
          this.filters.checkin = document.querySelector('[name="filter-checkin"]')?.value || '';
          this.filters.checkout = document.querySelector('[name="filter-checkout"]')?.value || '';
          this.filters.guests = parseInt(document.querySelector('[name="filter-guests"]')?.value) || 2;
          this.applyFilters();
        });
      }
    },

    /**
     * Apply filters to property cards
     */
    applyFilters() {
      const cards = document.querySelectorAll('.property-card, .card[data-property]');
      let visibleCount = 0;

      cards.forEach(card => {
        let visible = true;

        // Filter by type
        if (this.filters.types.length > 0) {
          const cardType = card.dataset.type || '';
          if (!this.filters.types.includes(cardType)) {
            visible = false;
          }
        }

        // Filter by price
        const cardPrice = parseInt(card.dataset.price) || 0;
        if (cardPrice < this.filters.priceMin || cardPrice > this.filters.priceMax) {
          visible = false;
        }

        // Filter by rating
        if (this.filters.rating > 0) {
          const cardRating = parseFloat(card.dataset.rating) || 0;
          if (cardRating < this.filters.rating) {
            visible = false;
          }
        }

        // Filter by location (text match)
        if (this.filters.location) {
          const cardLocation = (card.dataset.location || '').toLowerCase();
          if (!cardLocation.includes(this.filters.location.toLowerCase())) {
            visible = false;
          }
        }

        card.style.display = visible ? '' : 'none';
        if (visible) visibleCount++;
      });

      // Update results count
      const countEl = document.getElementById('resultsCount');
      if (countEl) {
        countEl.textContent = `${visibleCount} properties found`;
      }

      // Show/hide empty state
      const emptyState = document.getElementById('emptyState');
      if (emptyState) {
        emptyState.style.display = visibleCount === 0 ? '' : 'none';
      }
    },

    /**
     * Sort property cards
     */
    sortCards(sortBy) {
      const container = document.getElementById('propertyGrid');
      if (!container) return;

      const cards = Array.from(container.children);

      cards.sort((a, b) => {
        switch (sortBy) {
          case 'price-low':
            return (parseInt(a.dataset.price) || 0) - (parseInt(b.dataset.price) || 0);
          case 'price-high':
            return (parseInt(b.dataset.price) || 0) - (parseInt(a.dataset.price) || 0);
          case 'rating':
            return (parseFloat(b.dataset.rating) || 0) - (parseFloat(a.dataset.rating) || 0);
          case 'newest':
            return (b.dataset.created || '').localeCompare(a.dataset.created || '');
          default:
            return 0; // recommended = default order
        }
      });

      cards.forEach(card => container.appendChild(card));
    },

    /**
     * Clear all filters
     */
    clearFilters() {
      this.filters = {
        location: '',
        checkin: '',
        checkout: '',
        guests: 2,
        types: [],
        priceMin: 0,
        priceMax: 1000,
        rating: 0,
        amenities: [],
        sortBy: 'recommended'
      };

      // Reset form elements
      document.querySelectorAll('input[name="type"]').forEach(cb => cb.checked = false);
      document.querySelectorAll('input[name="amenity"]').forEach(cb => cb.checked = false);
      document.querySelectorAll('input[name="rating"]').forEach(r => r.checked = false);

      const priceMin = document.getElementById('priceMin');
      if (priceMin) priceMin.value = 0;
      const priceMax = document.getElementById('priceMax');
      if (priceMax) priceMax.value = 1000;

      this.applyFilters();
    }
  };

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Search.init());
  } else {
    Search.init();
  }

  window.TrendAccom = window.TrendAccom || {};
  window.TrendAccom.Search = Search;
})();
