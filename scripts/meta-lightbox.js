/**
 * Meta Lightbox
 * 
 * A modular, standalone JavaScript lightbox component for displaying card images
 * with metadata, designed to work with MetaMaster and other TCG projects.
 * 
 * Features:
 * - Embedded CSS (no external stylesheet needed)
 * - Card metadata display (HP, types, attacks, abilities, etc.)
 * - Extensible hook system for customization
 * - API support for fetching card data
 * - Keyboard navigation (Arrow keys, Escape)
 * - Touch/swipe support
 * - Responsive design
 * - Zero dependencies (vanilla JavaScript)
 * 
 * @version 1.0.0
 * @license MIT
 */

(function(window) {
  'use strict';

  /**
   * Default configuration
   */
  const DEFAULT_CONFIG = {
    // API configuration
    apiBaseUrl: null,                    // Base URL for API calls (e.g., '/api/cards')
    apiEndpoint: '/api/cards',           // Endpoint for fetching card data
    apiTimeout: 5000,                    // API request timeout (ms)
    
    // Display options
    showMetadata: true,                  // Show card metadata panel
    showNavigation: true,                // Show prev/next buttons
    showCounter: true,                   // Show "X of Y" counter
    showCloseButton: true,               // Show close button
    showFullscreen: false,               // Show fullscreen button
    
    // Behavior
    closeOnBackdropClick: true,          // Close when clicking outside
    closeOnEscape: true,                 // Close on Escape key
    keyboardNavigation: true,            // Enable keyboard navigation
    swipeNavigation: true,               // Enable touch/swipe navigation
    preloadImages: true,                 // Preload adjacent images
    
    // Styling
    theme: 'dark',                       // 'dark' or 'light'
    overlayOpacity: 0.9,                 // Background overlay opacity (0-1)
    animationDuration: 300,              // Animation duration (ms)
    
    // Metadata display
    metadataFields: [                    // Fields to display in metadata panel
      'name',
      'hp',
      'types',
      'subtypes',
      'supertype',
      'attacks',
      'abilities',
      'weaknesses',
      'resistances',
      'retreatCost',
      'rarity',
      'artist',
      'number'
    ],
    
    // Image handling
    imageLoader: null,                   // Custom image URL resolver function
    fallbackImage: '/assets/card-back.svg',  // Fallback image if loading fails
    
    // Hooks (all hooks receive event object with relevant data)
    hooks: {
      onInit: null,                      // Called when lightbox initializes
      onOpen: null,                      // Called when lightbox opens
      onClose: null,                     // Called when lightbox closes
      onCardChange: null,                // Called when card changes
      onImageLoad: null,                 // Called when image loads
      onImageError: null,                // Called when image fails to load
      onMetadataLoad: null,              // Called when metadata loads
      onMetadataError: null,             // Called when metadata fetch fails
      onPrev: null,                      // Called before navigating to previous
      onNext: null,                      // Called before navigating to next
      onKeyDown: null,                   // Called on keyboard input
      onSwipe: null,                     // Called on swipe gesture
      onCustomAction: null               // Called for custom actions
    },
    
    // Custom actions (buttons/actions in metadata panel)
    customActions: []
  };

  /**
   * Meta Lightbox Class
   */
  class MetaLightbox {
    constructor(config = {}) {
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.isOpen = false;
      this.currentIndex = -1;
      this.cards = [];
      this.currentCard = null;
      this.metadata = null;
      this.loadingMetadata = false;
      
      // DOM elements
      this.modal = null;
      this.imageEl = null;
      this.metadataEl = null;
      
      // Event listeners storage
      this.listeners = [];
      
      // Touch/swipe handling
      this.touchStartX = 0;
      this.touchStartY = 0;
      this.swipeThreshold = 50;
      
      // Initialize
      this.init();
      
      // Call init hook
      this.triggerHook('onInit', { lightbox: this });
    }

    /**
     * Initialize lightbox
     */
    init() {
      this.injectStyles();
      this.createModal();
      this.attachEventListeners();
    }

    /**
     * Inject embedded CSS styles
     */
    injectStyles() {
      // Check if styles already injected
      if (document.getElementById('meta-lightbox-styles')) {
        return;
      }

      const style = document.createElement('style');
      style.id = 'meta-lightbox-styles';
      style.textContent = `
        /* Meta Lightbox Styles */
        .meta-lightbox {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 10000;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity ${this.config.animationDuration}ms ease-in-out;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        
        .meta-lightbox.open {
          display: flex;
          opacity: 1;
        }
        
        .meta-lightbox-overlay {
          position: absolute;
          inset: 0;
          background: ${this.config.theme === 'dark' 
            ? `rgba(11, 11, 11, ${this.config.overlayOpacity})` 
            : `rgba(255, 255, 255, ${this.config.overlayOpacity})`};
        }
        
        .meta-lightbox-content {
          position: relative;
          z-index: 1;
          width: 70vw;
          max-width: 800px;
          height: 80vh;
          max-height: 700px;
          background: ${this.config.theme === 'dark' 
            ? 'linear-gradient(135deg, #1a1a1a 0%, #0b0b0b 100%)' 
            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)'};
          border-radius: 16px;
          border: 1px solid ${this.config.theme === 'dark' ? 'rgba(51, 65, 85, 0.7)' : 'rgba(226, 232, 240, 0.7)'};
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5),
                      0 0 30px rgba(90, 8, 102, 0.3);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transform: scale(0.95);
          transition: transform ${this.config.animationDuration}ms ease-in-out;
        }
        
        .meta-lightbox.open .meta-lightbox-content {
          transform: scale(1);
        }
        
        .meta-lightbox-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid ${this.config.theme === 'dark' ? 'rgba(51, 65, 85, 0.7)' : 'rgba(226, 232, 240, 0.7)'};
          flex-shrink: 0;
          background: ${this.config.theme === 'dark' ? 'rgba(15, 23, 42, 0.97)' : 'rgba(248, 250, 252, 0.97)'};
        }
        
        .meta-lightbox-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: ${this.config.theme === 'dark' ? '#f1f5f9' : '#0f172a'};
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1;
          min-width: 0;
        }
        
        .meta-lightbox-title-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .meta-lightbox-counter {
          font-size: 0.875rem;
          color: ${this.config.theme === 'dark' ? '#94a3b8' : '#64748b'};
          font-weight: 500;
          margin-left: 0.5rem;
          white-space: nowrap;
        }
        
        .meta-lightbox-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .meta-lightbox-btn {
          background: none;
          border: 1px solid ${this.config.theme === 'dark' ? 'rgba(71, 85, 105, 0.5)' : 'rgba(203, 213, 225, 0.5)'};
          color: ${this.config.theme === 'dark' ? '#cbd5e1' : '#475569'};
          font-size: 1rem;
          cursor: pointer;
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          height: 36px;
        }
        
        .meta-lightbox-btn:hover:not(:disabled) {
          background: ${this.config.theme === 'dark' ? 'rgba(71, 85, 105, 0.8)' : 'rgba(203, 213, 225, 0.8)'};
          color: ${this.config.theme === 'dark' ? '#f1f5f9' : '#0f172a'};
          transform: translateY(-1px);
        }
        
        .meta-lightbox-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        
        .meta-lightbox-close {
          font-size: 1.5rem;
          line-height: 1;
          padding: 0.25rem;
          border: none;
        }
        
        .meta-lightbox-body {
          flex: 1;
          display: flex;
          overflow: hidden;
          position: relative;
        }
        
        .meta-lightbox-image-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          overflow: hidden;
          position: relative;
          background: ${this.config.theme === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(241, 245, 249, 0.5)'};
        }
        
        .meta-lightbox-image-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .meta-lightbox-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          border-radius: 12px;
          opacity: 0;
          transition: opacity 0.3s ease-in-out;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        }
        
        .meta-lightbox-image.loaded {
          opacity: 1;
        }
        
        .meta-lightbox-spinner {
          position: absolute;
          width: 48px;
          height: 48px;
          border: 4px solid ${this.config.theme === 'dark' ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.3)'};
          border-top-color: ${this.config.theme === 'dark' ? '#666666' : '#3b82f6'};
          border-radius: 50%;
          animation: meta-lightbox-spin 0.8s linear infinite;
        }
        
        @keyframes meta-lightbox-spin {
          to { transform: rotate(360deg); }
        }
        
        .meta-lightbox-nav {
          position: absolute;
          top: 50%;
          left: 0.5rem;
          right: 0.5rem;
          transform: translateY(-50%);
          display: flex;
          justify-content: space-between;
          pointer-events: none;
          z-index: 10;
        }
        
        .meta-lightbox-nav-btn {
          pointer-events: auto;
          background: rgba(0, 0, 0, 0.5);
          color: white;
          border: none;
          border-radius: 50%;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 1.5rem;
          transition: all 0.2s ease;
          opacity: 0.7;
        }
        
        .meta-lightbox-nav-btn:hover:not(:disabled) {
          opacity: 1;
          background: rgba(0, 0, 0, 0.8);
          transform: scale(1.1);
        }
        
        .meta-lightbox-nav-btn:disabled {
          opacity: 0.2;
          cursor: not-allowed;
        }
        
        .meta-lightbox-metadata {
          width: 350px;
          flex-shrink: 0;
          padding: 1.5rem;
          overflow-y: auto;
          border-left: 1px solid ${this.config.theme === 'dark' ? 'rgba(51, 65, 85, 0.7)' : 'rgba(226, 232, 240, 0.7)'};
          background: ${this.config.theme === 'dark' ? 'rgba(15, 23, 42, 0.97)' : 'rgba(248, 250, 252, 0.97)'};
        }
        
        .meta-lightbox-metadata-section {
          margin-bottom: 1.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid ${this.config.theme === 'dark' ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.3)'};
        }
        
        .meta-lightbox-metadata-section:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        
        .meta-lightbox-metadata-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: ${this.config.theme === 'dark' ? '#f1f5f9' : '#0f172a'};
          margin-bottom: 1rem;
        }
        
        .meta-lightbox-metadata-field {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-bottom: 1rem;
        }
        
        .meta-lightbox-metadata-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: ${this.config.theme === 'dark' ? '#94a3b8' : '#64748b'};
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .meta-lightbox-metadata-value {
          font-size: 0.875rem;
          color: ${this.config.theme === 'dark' ? '#f1f5f9' : '#0f172a'};
          word-break: break-word;
        }
        
        .meta-lightbox-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
        
        .meta-lightbox-tag {
          padding: 0.375rem 0.75rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 500;
          border: 1px solid;
        }
        
        .meta-lightbox-tag-type {
          background: rgba(100, 100, 100, 0.2);
          color: #cccccc;
          border-color: rgba(100, 100, 100, 0.3);
        }
        
        .meta-lightbox-tag-subtype {
          background: rgba(168, 85, 247, 0.2);
          color: #c4b5fd;
          border-color: rgba(168, 85, 247, 0.3);
        }
        
        .meta-lightbox-tag-rarity {
          background: rgba(251, 191, 36, 0.2);
          color: #fcd34d;
          border-color: rgba(251, 191, 36, 0.3);
        }
        
        .meta-lightbox-attack,
        .meta-lightbox-ability {
          background: ${this.config.theme === 'dark' ? 'rgba(15, 23, 42, 0.5)' : 'rgba(241, 245, 249, 0.5)'};
          border: 1px solid ${this.config.theme === 'dark' ? 'rgba(71, 85, 105, 0.3)' : 'rgba(203, 213, 225, 0.3)'};
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 0.75rem;
        }
        
        .meta-lightbox-attack-header,
        .meta-lightbox-ability-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        
        .meta-lightbox-attack-name,
        .meta-lightbox-ability-name {
          font-weight: 600;
          color: ${this.config.theme === 'dark' ? '#f1f5f9' : '#0f172a'};
        }
        
        .meta-lightbox-attack-damage {
          padding: 0.25rem 0.5rem;
          background: rgba(239, 68, 68, 0.2);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 4px;
          font-weight: 700;
          font-size: 0.875rem;
        }
        
        .meta-lightbox-ability-type {
          padding: 0.25rem 0.5rem;
          background: rgba(251, 191, 36, 0.2);
          color: #fcd34d;
          border: 1px solid rgba(251, 191, 36, 0.3);
          border-radius: 4px;
          font-size: 0.75rem;
          text-transform: uppercase;
        }
        
        .meta-lightbox-attack-text,
        .meta-lightbox-ability-text {
          font-size: 0.875rem;
          color: ${this.config.theme === 'dark' ? '#cbd5e1' : '#475569'};
          line-height: 1.6;
          margin-top: 0.5rem;
        }
        
        .meta-lightbox-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
          flex-wrap: wrap;
        }
        
        .meta-lightbox-action-btn {
          flex: 1;
          min-width: 120px;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
          .meta-lightbox-content {
            width: 95vw;
            height: 95vh;
            flex-direction: column;
          }
          
          .meta-lightbox-metadata {
            width: 100%;
            max-height: 40vh;
            border-left: none;
            border-top: 1px solid ${this.config.theme === 'dark' ? 'rgba(51, 65, 85, 0.7)' : 'rgba(226, 232, 240, 0.7)'};
          }
          
          .meta-lightbox-image-container {
            padding: 1rem;
          }
        }
        
        /* Scrollbar styling */
        .meta-lightbox-metadata::-webkit-scrollbar {
          width: 8px;
        }
        
        .meta-lightbox-metadata::-webkit-scrollbar-track {
          background: ${this.config.theme === 'dark' ? 'rgba(15, 23, 42, 0.5)' : 'rgba(241, 245, 249, 0.5)'};
        }
        
        .meta-lightbox-metadata::-webkit-scrollbar-thumb {
          background: ${this.config.theme === 'dark' ? 'rgba(71, 85, 105, 0.5)' : 'rgba(203, 213, 225, 0.5)'};
          border-radius: 4px;
        }
        
        .meta-lightbox-metadata::-webkit-scrollbar-thumb:hover {
          background: ${this.config.theme === 'dark' ? 'rgba(71, 85, 105, 0.8)' : 'rgba(203, 213, 225, 0.8)'};
        }
      `;
      
      document.head.appendChild(style);
    }

    /**
     * Create modal DOM structure
     */
    createModal() {
      this.modal = document.createElement('div');
      this.modal.className = 'meta-lightbox';
      
      const overlay = document.createElement('div');
      overlay.className = 'meta-lightbox-overlay';
      
      const content = document.createElement('div');
      content.className = 'meta-lightbox-content';
      
      // Header
      const header = document.createElement('div');
      header.className = 'meta-lightbox-header';
      header.innerHTML = `
        <div class="meta-lightbox-title">
          <span class="meta-lightbox-title-text"></span>
          ${this.config.showCounter ? '<span class="meta-lightbox-counter"></span>' : ''}
        </div>
        <div class="meta-lightbox-controls">
          ${this.config.showCloseButton ? '<button class="meta-lightbox-btn meta-lightbox-close" aria-label="Close">×</button>' : ''}
        </div>
      `;
      
      // Body
      const body = document.createElement('div');
      body.className = 'meta-lightbox-body';
      
      // Image container
      const imageContainer = document.createElement('div');
      imageContainer.className = 'meta-lightbox-image-container';
      imageContainer.innerHTML = `
        <div class="meta-lightbox-image-wrapper">
          <div class="meta-lightbox-spinner"></div>
          <img class="meta-lightbox-image" alt="" />
        </div>
        ${this.config.showNavigation ? `
          <div class="meta-lightbox-nav">
            <button class="meta-lightbox-nav-btn meta-lightbox-prev" aria-label="Previous">‹</button>
            <button class="meta-lightbox-nav-btn meta-lightbox-next" aria-label="Next">›</button>
          </div>
        ` : ''}
      `;
      
      this.imageEl = imageContainer.querySelector('.meta-lightbox-image');
      
      // Metadata container
      if (this.config.showMetadata) {
        const metadataContainer = document.createElement('div');
        metadataContainer.className = 'meta-lightbox-metadata';
        this.metadataEl = metadataContainer;
        body.appendChild(imageContainer);
        body.appendChild(metadataContainer);
      } else {
        body.appendChild(imageContainer);
      }
      
      content.appendChild(header);
      content.appendChild(body);
      this.modal.appendChild(overlay);
      this.modal.appendChild(content);
      
      document.body.appendChild(this.modal);
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
      // Close button
      const closeBtn = this.modal.querySelector('.meta-lightbox-close');
      if (closeBtn) {
        this.addListener(closeBtn, 'click', (e) => {
          e.stopPropagation();
          this.close();
        });
      }
      
      // Navigation buttons
      const prevBtn = this.modal.querySelector('.meta-lightbox-prev');
      const nextBtn = this.modal.querySelector('.meta-lightbox-next');
      
      if (prevBtn) {
        this.addListener(prevBtn, 'click', (e) => {
          e.stopPropagation();
          this.prev();
        });
      }
      
      if (nextBtn) {
        this.addListener(nextBtn, 'click', (e) => {
          e.stopPropagation();
          this.next();
        });
      }
      
      // Backdrop click
      if (this.config.closeOnBackdropClick) {
        const overlay = this.modal.querySelector('.meta-lightbox-overlay');
        if (overlay) {
          this.addListener(overlay, 'click', () => {
            this.close();
          });
        }
        
        // Prevent closing when clicking content
        const content = this.modal.querySelector('.meta-lightbox-content');
        if (content) {
          this.addListener(content, 'click', (e) => {
            e.stopPropagation();
          });
        }
      }
      
      // Keyboard navigation
      if (this.config.keyboardNavigation) {
        this.addListener(document, 'keydown', (e) => {
          if (!this.isOpen) return;
          
          // Call hook first (allows preventing default behavior)
          const hookResult = this.triggerHook('onKeyDown', {
            key: e.key,
            code: e.code,
            preventDefault: () => e.preventDefault(),
            stopPropagation: () => e.stopPropagation()
          });
          
          if (hookResult === false) return; // Hook prevented default
          
          switch(e.key) {
            case 'Escape':
              if (this.config.closeOnEscape) this.close();
              break;
            case 'ArrowLeft':
              this.prev();
              break;
            case 'ArrowRight':
              this.next();
              break;
          }
        });
      }
      
      // Touch/swipe support
      if (this.config.swipeNavigation) {
        this.addListener(this.modal, 'touchstart', (e) => {
          this.touchStartX = e.touches[0].clientX;
          this.touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        this.addListener(this.modal, 'touchend', (e) => {
          if (!this.touchStartX || !this.touchStartY) return;
          
          const touchEndX = e.changedTouches[0].clientX;
          const touchEndY = e.changedTouches[0].clientY;
          const deltaX = touchEndX - this.touchStartX;
          const deltaY = touchEndY - this.touchStartY;
          
          // Only handle horizontal swipes (ignore if vertical swipe is larger)
          if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > this.swipeThreshold) {
            this.triggerHook('onSwipe', {
              direction: deltaX > 0 ? 'right' : 'left',
              deltaX,
              deltaY
            });
            
            if (deltaX > 0) {
              this.prev();
            } else {
              this.next();
            }
          }
          
          this.touchStartX = 0;
          this.touchStartY = 0;
        }, { passive: true });
      }
      
      // Image load events
      if (this.imageEl) {
        this.addListener(this.imageEl, 'load', () => {
          this.imageEl.classList.add('loaded');
          this.hideSpinner();
          this.triggerHook('onImageLoad', {
            card: this.currentCard,
            imageUrl: this.imageEl.src
          });
        });
        
        this.addListener(this.imageEl, 'error', () => {
          this.imageEl.src = this.config.fallbackImage;
          this.triggerHook('onImageError', {
            card: this.currentCard,
            attemptedUrl: this.imageEl.src
          });
        });
      }
    }

    /**
     * Helper: Add event listener with tracking
     */
    addListener(element, event, handler, options = {}) {
      element.addEventListener(event, handler, options);
      this.listeners.push({ element, event, handler, options });
    }

    /**
     * Helper: Trigger hook
     */
    triggerHook(hookName, data = {}) {
      const hook = this.config.hooks[hookName];
      if (typeof hook === 'function') {
        try {
          return hook({
            lightbox: this,
            ...data
          });
        } catch (error) {
          console.error(`MetaLightbox: Error in hook ${hookName}:`, error);
        }
      }
      return undefined;
    }

    /**
     * Open lightbox with cards
     * @param {Array} cards - Array of card objects
     * @param {number} startIndex - Index to start at (default: 0)
     */
    open(cards, startIndex = 0) {
      if (!cards || cards.length === 0) {
        console.warn('MetaLightbox: No cards provided');
        return;
      }
      
      this.cards = Array.isArray(cards) ? cards : [cards];
      this.currentIndex = Math.max(0, Math.min(startIndex, this.cards.length - 1));
      
      this.triggerHook('onOpen', {
        cards: this.cards,
        startIndex: this.currentIndex
      });
      
      this.isOpen = true;
      this.modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      
      this.updateDisplay();
    }

    /**
     * Close lightbox
     */
    close() {
      this.triggerHook('onClose', {
        currentCard: this.currentCard,
        currentIndex: this.currentIndex
      });
      
      this.isOpen = false;
      this.modal.classList.remove('open');
      document.body.style.overflow = '';
      
      // Clear after animation
      setTimeout(() => {
        if (!this.isOpen) {
          this.cards = [];
          this.currentCard = null;
          this.metadata = null;
          this.currentIndex = -1;
        }
      }, this.config.animationDuration);
    }

    /**
     * Navigate to previous card
     */
    prev() {
      if (this.currentIndex <= 0) return;
      
      const result = this.triggerHook('onPrev', {
        currentIndex: this.currentIndex,
        nextIndex: this.currentIndex - 1
      });
      
      if (result === false) return; // Hook prevented navigation
      
      this.currentIndex--;
      this.updateDisplay();
    }

    /**
     * Navigate to next card
     */
    next() {
      if (this.currentIndex >= this.cards.length - 1) return;
      
      const result = this.triggerHook('onNext', {
        currentIndex: this.currentIndex,
        nextIndex: this.currentIndex + 1
      });
      
      if (result === false) return; // Hook prevented navigation
      
      this.currentIndex++;
      this.updateDisplay();
    }

    /**
     * Update display with current card
     */
    async updateDisplay() {
      if (this.cards.length === 0) return;
      
      this.currentCard = this.cards[this.currentIndex];
      
      // Trigger card change hook
      this.triggerHook('onCardChange', {
        card: this.currentCard,
        index: this.currentIndex,
        total: this.cards.length
      });
      
      // Update title and counter
      const titleEl = this.modal.querySelector('.meta-lightbox-title-text');
      const counterEl = this.modal.querySelector('.meta-lightbox-counter');
      
      if (titleEl) {
        titleEl.textContent = this.getCardName(this.currentCard);
      }
      
      if (counterEl && this.config.showCounter) {
        counterEl.textContent = `${this.currentIndex + 1} of ${this.cards.length}`;
      }
      
      // Update image
      if (this.imageEl) {
        this.imageEl.classList.remove('loaded');
        this.showSpinner();
        
        // Resolve image URL
        const imageUrl = this.resolveImageUrl(this.currentCard);
        
        // Preload if enabled
        if (this.config.preloadImages) {
          this.preloadAdjacentImages();
        }
        
        this.imageEl.src = imageUrl;
        this.imageEl.alt = this.getCardName(this.currentCard);
      }
      
      // Update metadata
      if (this.config.showMetadata && this.metadataEl) {
        await this.updateMetadata();
      }
      
      // Update navigation buttons
      this.updateNavigationButtons();
    }

    /**
     * Resolve image URL from card object
     */
    resolveImageUrl(card) {
      // Use custom image loader if provided
      if (typeof this.config.imageLoader === 'function') {
        const customUrl = this.config.imageLoader(card);
        if (customUrl) return customUrl;
      }
      
      // Try various URL fields
      if (card.image_url) return card.image_url;
      if (card.imageUrl) return card.imageUrl;
      if (card.image) return card.image;
      if (card.card_data?.image_url) return card.card_data.image_url;
      if (card.images?.large) return card.images.large;
      if (card.images?.small) return card.images.small;
      
      // Generate evergreen URL if card has ID and set_id
      if (card.id && card.set_id) {
        return `/api/set/${card.set_id}/cards/${card.id}/image.webp`;
      }
      
      return this.config.fallbackImage;
    }

    /**
     * Get card name from card object
     */
    getCardName(card) {
      return card.name || card.card_data?.name || 'Unnamed Card';
    }

    /**
     * Update metadata panel
     */
    async updateMetadata() {
      if (!this.metadataEl) return;
      
      // Check if we need to fetch metadata
      if (this.config.apiBaseUrl || this.config.apiEndpoint) {
        this.loadingMetadata = true;
        try {
          const metadata = await this.fetchCardMetadata(this.currentCard);
          this.metadata = metadata;
          this.triggerHook('onMetadataLoad', {
            card: this.currentCard,
            metadata
          });
        } catch (error) {
          console.error('MetaLightbox: Failed to fetch metadata:', error);
          this.triggerHook('onMetadataError', {
            card: this.currentCard,
            error
          });
        } finally {
          this.loadingMetadata = false;
        }
      } else {
        // Use card data directly
        this.metadata = this.currentCard;
      }
      
      this.renderMetadata();
    }

    /**
     * Fetch card metadata from API
     */
    async fetchCardMetadata(card) {
      if (!this.config.apiBaseUrl && !this.config.apiEndpoint) {
        return card;
      }
      
      // Determine API URL
      let apiUrl = this.config.apiEndpoint;
      if (this.config.apiBaseUrl) {
        apiUrl = `${this.config.apiBaseUrl}${apiUrl}`;
      }
      
      // If card has ID, append to URL
      if (card.id) {
        apiUrl = `${apiUrl}/${card.id}`;
      } else if (card.set_id && card.card_number) {
        // Alternative: use set_id and card_number
        apiUrl = `${apiUrl}?set_id=${card.set_id}&card_number=${card.card_number}`;
      } else {
        // Can't fetch without identifier
        return card;
      }
      
      // Fetch with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.apiTimeout);
      
      try {
        const response = await fetch(apiUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
    }

    /**
     * Render metadata in panel
     */
    renderMetadata() {
      if (!this.metadataEl || !this.metadata) return;
      
      const card = this.metadata;
      const cardData = card.card_data || {};
      
      let html = '';
      
      // Basic Information Section
      html += '<div class="meta-lightbox-metadata-section">';
      html += '<div class="meta-lightbox-metadata-title">Card Information</div>';
      
      // Name (if not in title)
      if (card.name || cardData.name) {
        html += `<div class="meta-lightbox-metadata-field">
          <div class="meta-lightbox-metadata-label">Name</div>
          <div class="meta-lightbox-metadata-value">${this.escapeHtml(card.name || cardData.name)}</div>
        </div>`;
      }
      
      // Supertype
      if (card.supertype || cardData.supertype) {
        html += `<div class="meta-lightbox-metadata-field">
          <div class="meta-lightbox-metadata-label">Supertype</div>
          <div class="meta-lightbox-metadata-value">${this.escapeHtml(card.supertype || cardData.supertype)}</div>
        </div>`;
      }
      
      // HP
      if (card.hp || cardData.hp) {
        html += `<div class="meta-lightbox-metadata-field">
          <div class="meta-lightbox-metadata-label">HP</div>
          <div class="meta-lightbox-metadata-value">${card.hp || cardData.hp}</div>
        </div>`;
      }
      
      // Types
      const types = card.types || cardData.types || [];
      if (types.length > 0) {
        html += `<div class="meta-lightbox-metadata-field">
          <div class="meta-lightbox-metadata-label">Types</div>
          <div class="meta-lightbox-tags">`;
        types.forEach(type => {
          html += `<span class="meta-lightbox-tag meta-lightbox-tag-type">${this.escapeHtml(type)}</span>`;
        });
        html += `</div></div>`;
      }
      
      // Subtypes
      const subtypes = card.subtypes || cardData.subtypes || [];
      if (subtypes.length > 0) {
        html += `<div class="meta-lightbox-metadata-field">
          <div class="meta-lightbox-metadata-label">Subtypes</div>
          <div class="meta-lightbox-tags">`;
        subtypes.forEach(subtype => {
          html += `<span class="meta-lightbox-tag meta-lightbox-tag-subtype">${this.escapeHtml(subtype)}</span>`;
        });
        html += `</div></div>`;
      }
      
      // Number
      if (card.number || cardData.number || card.card_number) {
        html += `<div class="meta-lightbox-metadata-field">
          <div class="meta-lightbox-metadata-label">Number</div>
          <div class="meta-lightbox-metadata-value">${card.number || cardData.number || card.card_number}</div>
        </div>`;
      }
      
      // Rarity
      if (card.rarity || cardData.rarity) {
        html += `<div class="meta-lightbox-metadata-field">
          <div class="meta-lightbox-metadata-label">Rarity</div>
          <div class="meta-lightbox-metadata-value">
            <span class="meta-lightbox-tag meta-lightbox-tag-rarity">${this.escapeHtml(card.rarity || cardData.rarity)}</span>
          </div>
        </div>`;
      }
      
      html += '</div>';
      
      // Attacks Section
      const attacks = card.attacks || cardData.attacks || [];
      if (attacks.length > 0) {
        html += '<div class="meta-lightbox-metadata-section">';
        html += '<div class="meta-lightbox-metadata-title">Attacks</div>';
        attacks.forEach(attack => {
          html += `<div class="meta-lightbox-attack">
            <div class="meta-lightbox-attack-header">
              <div class="meta-lightbox-attack-name">${this.escapeHtml(attack.name || 'Unknown')}</div>
              ${attack.damage ? `<div class="meta-lightbox-attack-damage">${this.escapeHtml(String(attack.damage))}</div>` : ''}
            </div>
            ${attack.text ? `<div class="meta-lightbox-attack-text">${this.escapeHtml(attack.text)}</div>` : ''}
          </div>`;
        });
        html += '</div>';
      }
      
      // Abilities Section
      const abilities = card.abilities || cardData.abilities || [];
      if (abilities.length > 0) {
        html += '<div class="meta-lightbox-metadata-section">';
        html += '<div class="meta-lightbox-metadata-title">Abilities</div>';
        abilities.forEach(ability => {
          html += `<div class="meta-lightbox-ability">
            <div class="meta-lightbox-ability-header">
              <div class="meta-lightbox-ability-name">${this.escapeHtml(ability.name || 'Unknown')}</div>
              ${ability.type ? `<div class="meta-lightbox-ability-type">${this.escapeHtml(ability.type)}</div>` : ''}
            </div>
            ${ability.text ? `<div class="meta-lightbox-ability-text">${this.escapeHtml(ability.text)}</div>` : ''}
          </div>`;
        });
        html += '</div>';
      }
      
      // Weaknesses/Resistances
      const weaknesses = card.weaknesses || cardData.weaknesses || [];
      const resistances = card.resistances || cardData.resistances || [];
      
      if (weaknesses.length > 0 || resistances.length > 0) {
        html += '<div class="meta-lightbox-metadata-section">';
        html += '<div class="meta-lightbox-metadata-title">Weaknesses & Resistances</div>';
        
        if (weaknesses.length > 0) {
          html += `<div class="meta-lightbox-metadata-field">
            <div class="meta-lightbox-metadata-label">Weaknesses</div>
            <div class="meta-lightbox-tags">`;
          weaknesses.forEach(w => {
            const value = typeof w === 'string' ? w : (w.type || 'Unknown');
            html += `<span class="meta-lightbox-tag meta-lightbox-tag-type">${this.escapeHtml(value)}</span>`;
          });
          html += `</div></div>`;
        }
        
        if (resistances.length > 0) {
          html += `<div class="meta-lightbox-metadata-field">
            <div class="meta-lightbox-metadata-label">Resistances</div>
            <div class="meta-lightbox-tags">`;
          resistances.forEach(r => {
            const value = typeof r === 'string' ? r : (r.type || 'Unknown');
            html += `<span class="meta-lightbox-tag meta-lightbox-tag-type">${this.escapeHtml(value)}</span>`;
          });
          html += `</div></div>`;
        }
        
        html += '</div>';
      }
      
      // Retreat Cost
      if (card.retreatCost || cardData.retreatCost) {
        html += '<div class="meta-lightbox-metadata-section">';
        html += '<div class="meta-lightbox-metadata-title">Retreat Cost</div>';
        html += `<div class="meta-lightbox-metadata-value">${card.retreatCost || cardData.retreatCost}</div>`;
        html += '</div>';
      }
      
      // Artist
      if (card.artist || cardData.artist) {
        html += '<div class="meta-lightbox-metadata-section">';
        html += '<div class="meta-lightbox-metadata-title">Card Details</div>';
        html += `<div class="meta-lightbox-metadata-field">
          <div class="meta-lightbox-metadata-label">Artist</div>
          <div class="meta-lightbox-metadata-value">${this.escapeHtml(card.artist || cardData.artist)}</div>
        </div>`;
        html += '</div>';
      }
      
      // Custom Actions
      if (this.config.customActions && this.config.customActions.length > 0) {
        html += '<div class="meta-lightbox-metadata-section">';
        html += '<div class="meta-lightbox-actions">';
        this.config.customActions.forEach(action => {
          html += `<button class="meta-lightbox-btn meta-lightbox-action-btn" data-action="${this.escapeHtml(action.id)}">
            ${this.escapeHtml(action.label)}
          </button>`;
        });
        html += '</div></div>';
        
        // Attach action listeners
        this.metadataEl.querySelectorAll('[data-action]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const actionId = e.target.getAttribute('data-action');
            const action = this.config.customActions.find(a => a.id === actionId);
            if (action && action.handler) {
              this.triggerHook('onCustomAction', {
                actionId,
                action,
                card: this.currentCard
              });
              action.handler(this.currentCard, this);
            }
          });
        });
      }
      
      this.metadataEl.innerHTML = html;
    }

    /**
     * Update navigation button states
     */
    updateNavigationButtons() {
      const prevBtn = this.modal.querySelector('.meta-lightbox-prev');
      const nextBtn = this.modal.querySelector('.meta-lightbox-next');
      
      if (prevBtn) {
        prevBtn.disabled = this.currentIndex <= 0;
      }
      
      if (nextBtn) {
        nextBtn.disabled = this.currentIndex >= this.cards.length - 1;
      }
    }

    /**
     * Show loading spinner
     */
    showSpinner() {
      const wrapper = this.modal.querySelector('.meta-lightbox-image-wrapper');
      if (wrapper) {
        const spinner = wrapper.querySelector('.meta-lightbox-spinner');
        if (spinner) {
          spinner.style.display = 'block';
        }
      }
    }

    /**
     * Hide loading spinner
     */
    hideSpinner() {
      const wrapper = this.modal.querySelector('.meta-lightbox-image-wrapper');
      if (wrapper) {
        const spinner = wrapper.querySelector('.meta-lightbox-spinner');
        if (spinner) {
          spinner.style.display = 'none';
        }
      }
    }

    /**
     * Preload adjacent images
     */
    preloadAdjacentImages() {
      // Preload previous image
      if (this.currentIndex > 0) {
        const prevCard = this.cards[this.currentIndex - 1];
        const prevUrl = this.resolveImageUrl(prevCard);
        this.preloadImage(prevUrl);
      }
      
      // Preload next image
      if (this.currentIndex < this.cards.length - 1) {
        const nextCard = this.cards[this.currentIndex + 1];
        const nextUrl = this.resolveImageUrl(nextCard);
        this.preloadImage(nextUrl);
      }
    }

    /**
     * Preload single image
     */
    preloadImage(url) {
      const img = new Image();
      img.src = url;
    }

    /**
     * Escape HTML for safe rendering
     */
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
      if (newConfig.hooks) {
        this.config.hooks = { ...this.config.hooks, ...newConfig.hooks };
      }
    }

    /**
     * Destroy lightbox and clean up
     */
    destroy() {
      // Remove event listeners
      this.listeners.forEach(({ element, event, handler, options }) => {
        element.removeEventListener(event, handler, options);
      });
      this.listeners = [];
      
      // Remove modal from DOM
      if (this.modal && this.modal.parentNode) {
        this.modal.parentNode.removeChild(this.modal);
      }
      
      // Remove styles (optional - may be shared)
      // const styles = document.getElementById('meta-lightbox-styles');
      // if (styles) styles.remove();
      
      // Reset state
      this.isOpen = false;
      this.cards = [];
      this.currentCard = null;
      this.metadata = null;
      this.currentIndex = -1;
    }
  }

  // Export to window
  window.MetaLightbox = MetaLightbox;
  
  // Also create a simple factory function for convenience
  window.createMetaLightbox = function(config) {
    return new MetaLightbox(config);
  };

})(window);

