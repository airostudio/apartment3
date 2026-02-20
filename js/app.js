/**
 * TrendAccom - Main Application JavaScript
 * Handles: Navigation, hero slideshow, parallax, scroll animations,
 * mobile menu, tabs, modals, toasts, and general UI interactions
 */

(function() {
  'use strict';

  // ============================================
  // Header Scroll Behavior
  // ============================================
  const header = document.getElementById('siteHeader');

  function handleHeaderScroll() {
    if (!header) return;
    const scrollY = window.scrollY;

    if (header.classList.contains('site-header--transparent')) {
      if (scrollY > 50) {
        header.classList.add('site-header--scrolled');
      } else {
        header.classList.remove('site-header--scrolled');
      }
    }
  }

  // ============================================
  // Hero Slideshow
  // ============================================
  const slideshow = document.getElementById('heroSlideshow');
  let currentSlide = 0;
  let slideshowInterval;

  function initSlideshow() {
    if (!slideshow) return;
    const slides = slideshow.querySelectorAll('.hero-slide');
    if (slides.length <= 1) return;

    slideshowInterval = setInterval(() => {
      slides[currentSlide].classList.remove('active');
      currentSlide = (currentSlide + 1) % slides.length;
      slides[currentSlide].classList.add('active');
    }, 5000);
  }

  // ============================================
  // Hero Parallax Effect
  // ============================================
  function handleParallax() {
    const heroElements = document.querySelectorAll('.hero-parallax, .hero-slideshow, .hero-bg');
    const scrollY = window.scrollY;

    heroElements.forEach(el => {
      if (scrollY < window.innerHeight) {
        el.style.transform = `translateY(${scrollY * 0.4}px)`;
      }
    });
  }

  // ============================================
  // Scroll Fade-in Animations
  // ============================================
  function initScrollAnimations() {
    const fadeElements = document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right, .stagger-children');

    if (!fadeElements.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    fadeElements.forEach(el => observer.observe(el));
  }

  // Auto-add fade-in classes to sections
  function autoAddAnimations() {
    document.querySelectorAll('.section > .container > h2, .section > .container > .text-center').forEach(el => {
      if (!el.classList.contains('fade-in')) {
        el.classList.add('fade-in');
      }
    });

    document.querySelectorAll('.grid, .property-types, .grid-2, .grid-3, .grid-4').forEach(el => {
      if (!el.classList.contains('stagger-children') && !el.closest('.admin-layout')) {
        el.classList.add('stagger-children');
      }
    });
  }

  // ============================================
  // Mobile Menu
  // ============================================
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const mobileNav = document.getElementById('mobileNav');

  function initMobileMenu() {
    if (!mobileMenuToggle || !mobileNav) return;

    mobileMenuToggle.addEventListener('click', () => {
      mobileNav.classList.toggle('active');
      mobileMenuToggle.classList.toggle('active');
      document.body.style.overflow = mobileNav.classList.contains('active') ? 'hidden' : '';
    });

    // Close on link click
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('active');
        mobileMenuToggle.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // ============================================
  // Tabs
  // ============================================
  function initTabs() {
    document.querySelectorAll('.tabs').forEach(tabContainer => {
      const tabs = tabContainer.querySelectorAll('.tab');
      const parent = tabContainer.parentElement;

      tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
          e.preventDefault();

          // Remove active from all tabs
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');

          // Show corresponding content
          const targetId = tab.getAttribute('data-tab');
          if (targetId && parent) {
            parent.querySelectorAll('.tab-content').forEach(content => {
              content.classList.remove('active');
            });
            const target = parent.querySelector(`#${targetId}`);
            if (target) {
              target.classList.add('active');
            }
          }
        });
      });
    });
  }

  // ============================================
  // Toast Notifications
  // ============================================
  window.TrendAccom = window.TrendAccom || {};

  window.TrendAccom.showToast = function(message, type = 'info', duration = 4000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span>${message}</span>
      <button onclick="this.parentElement.remove()" style="margin-left: auto; opacity: 0.5; font-size: 18px;">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  // ============================================
  // Modal
  // ============================================
  window.TrendAccom.openModal = function(modalId) {
    const backdrop = document.getElementById(modalId);
    if (backdrop) {
      backdrop.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };

  window.TrendAccom.closeModal = function(modalId) {
    const backdrop = document.getElementById(modalId);
    if (backdrop) {
      backdrop.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  // Close modal on backdrop click
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
      e.target.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

  // Close modal on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.active').forEach(m => {
        m.classList.remove('active');
      });
      document.body.style.overflow = '';
    }
  });

  // ============================================
  // Favorite Toggle
  // ============================================
  function initFavorites() {
    document.querySelectorAll('.card-favorite').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.toggle('active');

        const isActive = btn.classList.contains('active');
        window.TrendAccom.showToast(
          isActive ? 'Added to favorites' : 'Removed from favorites',
          isActive ? 'success' : 'info'
        );
      });
    });
  }

  // ============================================
  // Search Functionality
  // ============================================
  window.performSearch = function() {
    const location = document.getElementById('searchLocation')?.value || '';
    const checkin = document.getElementById('searchCheckin')?.value || '';
    const checkout = document.getElementById('searchCheckout')?.value || '';
    const guests = document.getElementById('searchGuests')?.value || '2';

    const params = new URLSearchParams();
    if (location) params.set('location', location);
    if (checkin) params.set('checkin', checkin);
    if (checkout) params.set('checkout', checkout);
    if (guests) params.set('guests', guests);

    window.location.href = `search.html?${params.toString()}`;
  };

  // Set minimum dates for date inputs
  function initDateInputs() {
    const today = new Date().toISOString().split('T')[0];

    const checkinInput = document.getElementById('searchCheckin');
    const checkoutInput = document.getElementById('searchCheckout');

    if (checkinInput) {
      checkinInput.setAttribute('min', today);
      checkinInput.addEventListener('change', () => {
        if (checkoutInput) {
          const nextDay = new Date(checkinInput.value);
          nextDay.setDate(nextDay.getDate() + 1);
          checkoutInput.setAttribute('min', nextDay.toISOString().split('T')[0]);
          if (checkoutInput.value && checkoutInput.value <= checkinInput.value) {
            checkoutInput.value = nextDay.toISOString().split('T')[0];
          }
        }
      });
    }

    if (checkoutInput) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      checkoutInput.setAttribute('min', tomorrow.toISOString().split('T')[0]);
    }
  }

  // ============================================
  // Admin Sidebar Toggle
  // ============================================
  function initAdminSidebar() {
    const toggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.admin-sidebar');

    if (!toggle || !sidebar) return;

    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 992 &&
          sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) &&
          !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  // ============================================
  // Smooth Scroll
  // ============================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ============================================
  // URL Parameter Helpers
  // ============================================
  window.TrendAccom.getUrlParams = function() {
    return Object.fromEntries(new URLSearchParams(window.location.search));
  };

  // ============================================
  // Format Currency
  // ============================================
  window.TrendAccom.formatCurrency = function(amount, currency = 'AUD') {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // ============================================
  // Format Date
  // ============================================
  window.TrendAccom.formatDate = function(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // ============================================
  // Initialize Everything
  // ============================================
  function init() {
    handleHeaderScroll();
    initSlideshow();
    initMobileMenu();
    initTabs();
    initFavorites();
    initDateInputs();
    initAdminSidebar();
    autoAddAnimations();
    initScrollAnimations();

    // Scroll event listeners
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleHeaderScroll();
          handleParallax();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
