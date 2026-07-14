if (!customElements.get('custom-quick-view')) {
  // Custom Web Component managing individual quick view popup modal windows
  class CustomQuickView extends HTMLElement {
    constructor() {
      super();
      // Parse variant JSON stored on the component data attribute for fast lookups without network requests
      this.variants = JSON.parse(this.dataset.variants || '[]');
      this.toastTimeout = null;
    }

    // Invoked automatically when the element is appended to the document object model
    connectedCallback() {
      // Cache important elements locally to prevent recurring DOM query operations
      this.modal = this.querySelector('.custom-quick-view-modal');
      this.backdrop = this.querySelector('.custom-quick-view-modal__backdrop');
      this.closeBtn = this.querySelector('.custom-quick-view-modal__close');
      this.form = this.querySelector('.custom-quick-view-form');
      this.submitBtn = this.querySelector('.custom-quick-view-submit');
      this.idInput = this.querySelector('input[name="id"]');
      this.priceEl = this.querySelector('.custom-quick-view__price');
      this.comparePriceEl = this.querySelector('.custom-quick-view__compare-price');

      // Attach event listener to close the modal when clicking the 'X' button
      if (this.closeBtn) {
        this.closeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.close();
        });
      }

      // Close the modal when clicking outside the content area on the dark overlay backdrop
      if (this.backdrop) {
        this.backdrop.addEventListener('click', (e) => {
          e.preventDefault();
          this.close();
        });
      }

      // Handle Escape keyboard clicks to close the popup automatically for a better user experience
      this.escapeHandler = (e) => {
        if (e.key === 'Escape' && this.modal.classList.contains('is-active')) {
          this.close();
        }
      };
      document.addEventListener('keydown', this.escapeHandler);

      // Bind form change listeners to dynamically re-calculate pricing and availability on variant changes
      if (this.form) {
        this.form.addEventListener('change', () => this.updateVariant());
        this.form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.addToCart(this.idInput.value);
        });
      }

      // Initialize dynamic slide animations for color selectors and setup custom dropdown overlays
      this.initColorSliders();
      this.initDropdowns();
    }

    // Cleanup global listeners when the element is destroyed to prevent memory leaks
    disconnectedCallback() {
      document.removeEventListener('keydown', this.escapeHandler);
    }

    // Display the modal and block background scroll to keep the focus on variant selection
    open() {
      this.modal.classList.add('is-active');
      document.body.style.overflow = 'hidden';
    }

    // Dismiss the modal overlay and restore default browser scroll settings
    close() {
      this.modal.classList.remove('is-active');
      document.body.style.overflow = '';
    }

    // Listens for color selection changes and updates CSS custom properties to animate the active indicator bar
    initColorSliders() {
      this.querySelectorAll('.custom-option-values--color').forEach((container) => {
        container.addEventListener('change', (e) => {
          if (e.target.tagName === 'INPUT') {
            const radios = Array.from(container.querySelectorAll('input[type="radio"]'));
            const activeIdx = radios.findIndex((r) => r.checked);
            // Shift the CSS sliding block based on the index position of the chosen color
            if (activeIdx !== -1) {
              container.style.setProperty('--active-index', activeIdx);
            }
          }
        });
      });
    }

    // Builds accessibility-friendly dropdown selectors, linking click options to native hidden radios
    initDropdowns() {
      this.querySelectorAll('.custom-dropdown-select').forEach((dropdown) => {
        const trigger = dropdown.querySelector('.custom-dropdown-select__trigger');
        const triggerText = dropdown.querySelector('.custom-dropdown-select__trigger-text');
        const group = dropdown.closest('.custom-option-group');
        if (!group) return;

        // Toggle dropdown open states and close any other open dropdowns on the page
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          this.querySelectorAll('.custom-dropdown-select').forEach((other) => {
            if (other !== dropdown) other.classList.remove('is-open');
          });
          dropdown.classList.toggle('is-open');
        });

        // Handle custom option selection
        dropdown.querySelectorAll('.custom-dropdown-select__option').forEach((optionEl) => {
          optionEl.addEventListener('click', () => {
            const val = optionEl.getAttribute('data-value');
            triggerText.innerText = val;
            dropdown.classList.remove('is-open');

            // Toggle selected classes for active CSS rules
            dropdown.querySelectorAll('.custom-dropdown-select__option').forEach((el) => {
              el.classList.toggle('is-selected', el === optionEl);
            });

            // Synchronize chosen option with underlying radio inputs to trigger variant calculation
            const radio = group.querySelector(`input[type="radio"][value="${val}"]`);
            if (radio) {
              radio.checked = true;
              radio.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
        });
      });

      // Close dropdowns if the user clicks anywhere outside of the dropdown container
      document.addEventListener('click', () => {
        this.querySelectorAll('.custom-dropdown-select').forEach((d) => d.classList.remove('is-open'));
      });
    }

    // Matches checked values against product options and updates price tags, labels, and checkout availability
    updateVariant() {
      if (this.variants.length === 0) return;
      const numOptions = this.variants[0].options.length;
      const selectedOptions = new Array(numOptions);

      // Fetch checked choices from each option group block
      this.querySelectorAll('.custom-option-group').forEach((group) => {
        const optIdx = parseInt(group.getAttribute('data-option-index'), 10);
        const checkedRadio = group.querySelector('input[type="radio"]:checked');
        if (checkedRadio) {
          selectedOptions[optIdx] = checkedRadio.value;
        }
      });

      // Search the variants JSON to find a match that corresponds with our selected option combination
      const variant = this.variants.find((v) => {
        return v.options.every((opt, idx) => opt === selectedOptions[idx]);
      });

      if (variant) {
        // Sync input target id and disable form submission if variant has no stock
        this.idInput.value = variant.id;
        this.idInput.disabled = !variant.available;

        if (variant.available) {
          this.submitBtn.removeAttribute('disabled');
          const btnText = this.querySelector('.custom-submit-text');
          if (btnText) btnText.innerText = 'Add to Cart';
          const btnArrow = this.querySelector('.custom-submit-arrow');
          if (btnArrow) btnArrow.style.display = '';
        } else {
          this.submitBtn.setAttribute('disabled', 'true');
          const btnText = this.querySelector('.custom-submit-text');
          if (btnText) btnText.innerText = 'Sold Out';
          const btnArrow = this.querySelector('.custom-submit-arrow');
          if (btnArrow) btnArrow.style.display = 'none';
        }

        // Format price display text using theme helpers or basic dollar conversion
        if (this.priceEl) {
          const formattedPrice = this.formatMoney(variant.price);
          this.priceEl.innerHTML = formattedPrice;
        }

        // Calculate compare price values and toggle markdown indicator visibility
        if (this.comparePriceEl) {
          if (variant.compare_at_price > variant.price) {
            this.comparePriceEl.innerHTML = this.formatMoney(variant.compare_at_price);
            this.comparePriceEl.style.display = '';
          } else {
            this.comparePriceEl.innerHTML = '';
            this.comparePriceEl.style.display = 'none';
          }
        }
      } else {
        // If no variant configuration is found, disable the submit action
        this.submitBtn.setAttribute('disabled', 'true');
        const btnText = this.querySelector('.custom-submit-text');
        if (btnText) btnText.innerText = 'Unavailable';
        const btnArrow = this.querySelector('.custom-submit-arrow');
        if (btnArrow) btnArrow.style.display = 'none';
      }
    }

    // Add selected variants to the cart asynchronously using Shopify's AJAX API
    async addToCart(variantId) {
      if (!variantId) return;

      // Toggle state to visual loading mode so users aren't left guessing if the click worked
      if (this.submitBtn) {
        this.submitBtn.setAttribute('disabled', 'true');
        this.submitBtn.innerHTML = '<span class="custom-quick-view-spinner"></span> Adding...';
      }

      // Detect if this selection has Black and Medium variant selected, that accordingly adds Soft Winter Jacket to cart as requested in instructions link
      const selectedOptions = Array.from(this.querySelectorAll('input[type="radio"]:checked')).map((r) =>
        r.value.trim().toLowerCase()
      );
      const hasBlack = selectedOptions.includes('black');
      const hasMedium = selectedOptions.includes('medium') || selectedOptions.includes('m');

      const items = [
        {
          id: variantId,
          quantity: 1,
        },
      ];

      // Push the Soft Winter Jacket to cart if the added-to-cart product is black color and medium size variants
      if (hasBlack && hasMedium) {
        items.push({
          id: 56764156051622,
          quantity: 1,
        });
      }

      try {
        const rootPath = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
        //Send products data to shopify cart usingAJAX API through the body of the POST request
        const response = await fetch(rootPath + 'cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            items: items,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          // Alert user success, update global header counters, and dismiss the modal window
          this.showSuccessToast();
          this.updateGlobalCartCount();
          this.close();
        } else {
          alert('Failed to add item to cart.');
        }
      } catch (error) {
        console.error('Error adding to cart:', error);
        alert('Network error. Please try again.');
      } finally {
        // Re-enable checkout button and restore default styles
        if (this.submitBtn) {
          this.submitBtn.removeAttribute('disabled');
          this.submitBtn.innerHTML = `
            <span class="custom-submit-text">Add to Cart</span>
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="custom-submit-arrow">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          `;
          this.updateVariant();
        }
      }
    }

    //Show cart toast notification if the product is added to the cart successfully
    showSuccessToast() {
      const toast = document.getElementById('custom-cart-toast');
      if (!toast) return;

      toast.classList.add('is-active');

      if (this.toastTimeout) clearTimeout(this.toastTimeout);
      this.toastTimeout = setTimeout(() => {
        toast.classList.remove('is-active');
      }, 4000);
    }

    //Update cart count in the header
    async updateGlobalCartCount() {
      try {
        const rootPath = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
        const response = await fetch(rootPath + 'cart.js');
        const cart = await response.json();

        const countElements = document.querySelectorAll(
          '.cart-count, .cart-counter, [data-cart-count], .header-actions__cart-icon span, .cart-icon-bubble span'
        );
        countElements.forEach((el) => {
          el.innerText = cart.item_count;
          el.classList.remove('hidden');
        });
      } catch (error) {
        console.error('Error updating cart count:', error);
      }
    }

    //Format price in cents to dollar format
    formatMoney(cents) {
      if (typeof Shopify !== 'undefined' && Shopify.formatMoney) {
        return Shopify.formatMoney(cents);
      }
      return '$' + (cents / 100).toFixed(2);
    }
  }
  customElements.define('custom-quick-view', CustomQuickView);

  // Listen for click events globally to open the Quick View modal
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.custom-product-card__quick-add-trigger');
    if (trigger) {
      e.preventDefault();
      const productId = trigger.getAttribute('data-product-id');
      const sectionId = trigger.getAttribute('data-section-id');
      const modal = document.getElementById('quick-view-' + sectionId + '-' + productId);
      if (modal) {
        modal.open();
      }
    }
  });
}
