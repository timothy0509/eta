// src/ui-animations.js - UI animations and micro-interactions
;(function() {
  'use strict';

  // Safe localStorage operations with error handling
  function safeGetItem(key, defaultValue = null) {
    try {
      return localStorage.getItem(key) || defaultValue;
    } catch (e) {
      console.warn('localStorage getItem failed:', e);
      return defaultValue;
    }
  }

  function safeSetItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('localStorage setItem failed:', e);
    }
  }

  /**
   * Enhanced ripple effect handler
   * Creates a Material Design ripple animation on elements with .ripple class
   * The ripple emanates from the click position and expands outward
   */
  function initRippleEffect() {
    document.addEventListener('click', function(e) {
      const rippleElement = e.target.closest('.ripple');
      if (!rippleElement) return;

      // Create ripple container if it doesn't exist
      let rippleContainer = rippleElement.querySelector('.ripple-container');
      if (!rippleContainer) {
        rippleContainer = document.createElement('div');
        rippleContainer.className = 'ripple-container';
        rippleElement.style.position = 'relative';
        rippleElement.appendChild(rippleContainer);
      }

      // Create ripple wave element
      const ripple = document.createElement('span');
      ripple.className = 'ripple-wave';

      // Get click position relative to element
      const rect = rippleElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Set ripple position centered on click point
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';

      // Calculate ripple size to cover entire element diagonal
      const size = Math.max(rect.width, rect.height) * 2;
      ripple.style.width = size + 'px';
      ripple.style.height = size + 'px';

      // Add ripple to container
      rippleContainer.appendChild(ripple);

      // Remove ripple after animation completes to prevent memory leaks
      ripple.addEventListener('animationend', function() {
        ripple.remove();
      }, { once: true });
    }, { passive: true });
  }

  /**
   * Floating Action Button (FAB) animations
   * Animates FAB entrance and handles scroll-based visibility
   */
  function initFABAnimations() {
    const fab = document.querySelector('.fab');
    if (!fab) return;

    // Add entrance animation class
    fab.classList.add('fab-enter');

    // Optional: Hide/show FAB based on scroll direction
    let lastScrollTop = 0;
    let scrollTimeout;

    window.addEventListener('scroll', function() {
      clearTimeout(scrollTimeout);
      
      scrollTimeout = setTimeout(function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > lastScrollTop && scrollTop > 100) {
          // Scrolling down - hide FAB
          fab.style.transform = 'translateY(100px) scale(0.8)';
          fab.style.opacity = '0';
        } else if (scrollTop < lastScrollTop) {
          // Scrolling up - show FAB
          fab.style.transform = 'scale(1)';
          fab.style.opacity = '1';
        }
        
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
      }, 50);
    }, { passive: true });

    // Reset transition on hover
    fab.addEventListener('mouseenter', function() {
      fab.style.transition = 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    });
  }

  /**
   * List item entrance animations using Intersection Observer
   * Adds staggered entrance animations to dynamically added list items
   * Creates a cascading effect where items appear sequentially
   * @param {HTMLElement} container - The container element with list items
   */
  const listObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        const item = entry.target;
        if (item.dataset.animating === 'true') return;
        
        item.dataset.animating = 'true';
        item.classList.add('list-item-enter');
        
        // Clean up after animation completes
        item.addEventListener('animationend', function() {
          item.style.animationDelay = '';
          listObserver.unobserve(item);
        }, { once: true });
      }
    });
  }, {
    threshold: 0.01,
    rootMargin: '0px 0px -50px 0px'
  });

  function animateListItems(container) {
    if (!container) return;

    const items = container.querySelectorAll('.mobile-card, .eta-table-container, tr.eta-data-row');
    const STAGGER_DELAY_MS = 50; // Delay between each item animation
    
    items.forEach(function(item, index) {
      // Skip items that are already animated
      if (item.dataset.animating === 'true') return;
      
      // Set animation delay for stagger effect
      item.style.animationDelay = (index * STAGGER_DELAY_MS) + 'ms';
      
      // Observe item for viewport intersection
      listObserver.observe(item);
    });
  }

  /**
   * Theme toggle with enhanced persistence
   * Maintains theme preference across sessions and adds smooth transitions
   */
  function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;

    // Get saved theme from localStorage
    const savedTheme = safeGetItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Set initial theme based on saved preference or system preference
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    themeToggle.checked = isDark;
    document.documentElement.classList.toggle('dark-mode', isDark);

    // Listen for theme toggle changes
    themeToggle.addEventListener('change', function() {
      const isDarkMode = this.checked;
      
      // Add transition class for smooth theme switching
      document.documentElement.style.transition = 'background 0.3s, color 0.3s';
      document.documentElement.classList.toggle('dark-mode', isDarkMode);
      
      // Save preference
      safeSetItem('theme', isDarkMode ? 'dark' : 'light');
      
      // Remove transition after it completes to avoid affecting other animations
      setTimeout(function() {
        document.documentElement.style.transition = '';
      }, 300);
      
      // Dispatch custom event for other components to react to theme change
      window.dispatchEvent(new CustomEvent('themechange', {
        detail: { theme: isDarkMode ? 'dark' : 'light' }
      }));
    });

    // Listen for system theme preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
      // Only auto-switch if user hasn't set a preference
      if (!safeGetItem('theme')) {
        themeToggle.checked = e.matches;
        document.documentElement.classList.toggle('dark-mode', e.matches);
      }
    });
  }

  /**
   * Hover elevation effect
   * Adds subtle elevation changes on hover for interactive elements
   */
  function initHoverElevation() {
    const elevateElements = document.querySelectorAll('.elevate-hover, .card');
    
    elevateElements.forEach(function(element) {
      element.addEventListener('mouseenter', function() {
        this.style.transition = 'box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
      });
    });
  }

  /**
   * Observe results container for new content
   * Automatically animates new items when they're added to the results
   * Uses MutationObserver for efficient DOM change detection
   * @returns {MutationObserver|undefined} The observer instance
   */
  function observeResultsContainer() {
    const resultsContainer = document.getElementById('results');
    if (!resultsContainer) {
      console.warn('Results container not found');
      return;
    }

    // Create a MutationObserver to watch for new content
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length) {
          // Debounce animation calls to avoid performance issues
          if (observeResultsContainer.animationTimeout) {
            clearTimeout(observeResultsContainer.animationTimeout);
          }
          observeResultsContainer.animationTimeout = setTimeout(function() {
            animateListItems(resultsContainer);
          }, 100);
        }
      });
    });

    // Start observing with optimized config
    observer.observe(resultsContainer, {
      childList: true,
      subtree: true
    });

    return observer;
  }

  /**
   * Add focus-visible polyfill behavior for keyboard navigation
   */
  function initFocusVisible() {
    let hadKeyboardEvent = false;

    document.addEventListener('keydown', function() {
      hadKeyboardEvent = true;
    });

    document.addEventListener('mousedown', function() {
      hadKeyboardEvent = false;
    });

    document.addEventListener('focusin', function(e) {
      if (hadKeyboardEvent) {
        e.target.classList.add('focus-visible');
      }
    });

    document.addEventListener('focusout', function(e) {
      e.target.classList.remove('focus-visible');
    });
  }

  /**
   * Page transition effects
   * Smooth transitions when content changes
   */
  function initPageTransitions() {
    const resultsContainer = document.getElementById('results');
    if (!resultsContainer) return;

    // Add transition class when content is about to change
    const originalInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    
    // Store reference to trigger transition on content changes
    window.TimoETA = window.TimoETA || {};
    window.TimoETA.transitionResults = function() {
      if (resultsContainer.children.length > 0) {
        resultsContainer.classList.add('page-transition-exit');
        
        setTimeout(function() {
          resultsContainer.classList.remove('page-transition-exit');
          resultsContainer.classList.add('page-transition-enter');
          
          setTimeout(function() {
            resultsContainer.classList.remove('page-transition-enter');
          }, 400);
        }, 250);
      }
    };
  }

  /**
   * Initialize all animations and interactions
   */
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    // Initialize all features
    initRippleEffect();
    initFABAnimations();
    initThemeToggle();
    initHoverElevation();
    observeResultsContainer();
    initFocusVisible();
    initPageTransitions();

    // Initial animation for existing list items
    const resultsContainer = document.getElementById('results');
    if (resultsContainer && resultsContainer.children.length > 0) {
      animateListItems(resultsContainer);
    }
  }

  // Export functions for external use
  window.TimoETA = window.TimoETA || {};
  window.TimoETA.animateListItems = animateListItems;

  // Start initialization
  init();
})();
