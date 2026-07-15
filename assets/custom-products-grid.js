(function() {
  let toastTimeout = null;

  // Initialize variant states when a modal is opened or options change
  function updateVariant(modal) {
    const variants = JSON.parse(modal.dataset.variants || '[]');
    if (variants.length === 0) return;

    const form = modal.querySelector('.custom-quick-view-form');
    const submitBtn = modal.querySelector('.custom-quick-view-submit');
    const idInput = modal.querySelector('input[name="id"]');
    const priceEl = modal.querySelector('.custom-quick-view__price');
    const comparePriceEl = modal.querySelector('.custom-quick-view__compare-price');

    const numOptions = variants[0].options.length;
    const selectedOptions = new Array(numOptions);

    // Fetch checked choices from each option group block and check for missing selections
    let missingSelectionName = null;
    modal.querySelectorAll('.custom-option-group').forEach((group) => {
      const optIdx = parseInt(group.getAttribute('data-option-index'), 10);
      const checkedRadio = group.querySelector('input[type="radio"]:checked');
      if (checkedRadio) {
        selectedOptions[optIdx] = checkedRadio.value;
      } else {
        const label = group.querySelector('.custom-option-label');
        missingSelectionName = label ? label.innerText.trim() : 'Option';
      }
    });

    if (missingSelectionName) {
      submitBtn.setAttribute('disabled', 'true');
      const btnText = modal.querySelector('.custom-submit-text');
      if (btnText) btnText.innerText = 'Add to Cart';
      const btnArrow = modal.querySelector('.custom-submit-arrow');
      if (btnArrow) btnArrow.style.display = '';
      return;
    }

    // Search the variants JSON to find a match that corresponds with our selected option combination
    const variant = variants.find((v) => {
      return v.options.every((opt, idx) => opt === selectedOptions[idx]);
    });

    if (variant) {
      // Sync input target id and disable form submission if variant has no stock
      idInput.value = variant.id;
      idInput.disabled = !variant.available;

      if (variant.available) {
        submitBtn.removeAttribute('disabled');
        const btnText = modal.querySelector('.custom-submit-text');
        if (btnText) btnText.innerText = 'Add to Cart';
        const btnArrow = modal.querySelector('.custom-submit-arrow');
        if (btnArrow) btnArrow.style.display = '';
      } else {
        submitBtn.setAttribute('disabled', 'true');
        const btnText = modal.querySelector('.custom-submit-text');
        if (btnText) btnText.innerText = 'Sold Out';
        const btnArrow = modal.querySelector('.custom-submit-arrow');
        if (btnArrow) btnArrow.style.display = 'none';
      }

      // Format price display text using theme helpers or basic dollar conversion
      if (priceEl) {
        priceEl.innerHTML = formatMoney(variant.price);
      }

      // Calculate compare price values and toggle markdown indicator visibility
      if (comparePriceEl) {
        if (variant.compare_at_price > variant.price) {
          comparePriceEl.innerHTML = formatMoney(variant.compare_at_price);
          comparePriceEl.style.display = '';
        } else {
          comparePriceEl.innerHTML = '';
          comparePriceEl.style.display = 'none';
        }
      }
    } else {
      // If no variant configuration is found, disable the submit action
      submitBtn.setAttribute('disabled', 'true');
      const btnText = modal.querySelector('.custom-submit-text');
      if (btnText) btnText.innerText = 'Unavailable';
      const btnArrow = modal.querySelector('.custom-submit-arrow');
      if (btnArrow) btnArrow.style.display = 'none';
    }
  }

  // Add selected variants to the cart asynchronously using Shopify's AJAX API
  async function addToCart(modal) {
    const form = modal.querySelector('.custom-quick-view-form');
    const submitBtn = modal.querySelector('.custom-quick-view-submit');
    const idInput = modal.querySelector('input[name="id"]');
    const variantId = idInput.value;

    if (!variantId) return;

    // Toggle state to visual loading mode so users aren't left guessing if the click worked
    if (submitBtn) {
      submitBtn.setAttribute('disabled', 'true');
      const btnText = submitBtn.querySelector('.custom-submit-text');
      if (btnText) {
        btnText.dataset.originalText = btnText.innerText;
        btnText.innerText = 'Adding...';
      }
      const btnArrow = submitBtn.querySelector('.custom-submit-arrow');
      if (btnArrow) btnArrow.style.display = 'none';

      let spinner = submitBtn.querySelector('.custom-quick-view-spinner');
      if (!spinner) {
        spinner = document.createElement('span');
        spinner.className = 'custom-quick-view-spinner';
        submitBtn.prepend(spinner);
      } else {
        spinner.style.display = '';
      }
    }

    // Detect if this selection has Black and Medium variant selected, that accordingly adds Soft Winter Jacket to cart as requested in instructions link
    const selectedOptions = Array.from(modal.querySelectorAll('input[type="radio"]:checked')).map((r) =>
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
      // Send products data to shopify cart using AJAX API through the body of the POST request
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

      if (response.ok) {
        // Alert user success, update global header counters, and dismiss the modal window
        showSuccessToast();
        updateGlobalCartCount();
        closeModal(modal);
      } else {
        alert('Failed to add item to cart.');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Network error. Please try again.');
    } finally {
      // Re-enable checkout button and restore default styles
      if (submitBtn) {
        submitBtn.removeAttribute('disabled');
        const btnText = submitBtn.querySelector('.custom-submit-text');
        if (btnText && btnText.dataset.originalText) {
          btnText.innerText = btnText.dataset.originalText;
        }
        const btnArrow = submitBtn.querySelector('.custom-submit-arrow');
        if (btnArrow) btnArrow.style.display = '';
        const spinner = submitBtn.querySelector('.custom-quick-view-spinner');
        if (spinner) spinner.style.display = 'none';
        updateVariant(modal);
      }
    }
  }

  // Reset modal selections back to defaults
  function resetModal(modal) {
    const form = modal.querySelector('.custom-quick-view-form');
    if (form) {
      form.reset();
    }

    // Reset dropdown trigger texts and active selections
    modal.querySelectorAll('.custom-option-group').forEach((group) => {
      const label = group.querySelector('.custom-option-label');
      const optionName = label ? label.innerText.replace(':', '').trim().toLowerCase() : 'size';
      
      const dropdown = group.querySelector('.custom-dropdown-select');
      if (dropdown) {
        const triggerText = dropdown.querySelector('.custom-dropdown-select__trigger-text');
        if (triggerText) {
          triggerText.innerText = 'Choose your ' + optionName;
        }
        dropdown.querySelectorAll('.custom-dropdown-select__option').forEach((opt) => {
          opt.classList.remove('is-selected');
        });
      }

      // Reset color indicators
      const colorContainer = group.querySelector('.custom-option-values--color');
      if (colorContainer) {
        initColorSlider(colorContainer);
      }
    });
  }

  // Display the modal and block background scroll
  function openModal(modal) {
    resetModal(modal);
    const modalInner = modal.querySelector('.custom-quick-view-modal');
    if (modalInner) modalInner.classList.add('is-active');
    document.body.style.overflow = 'hidden';
    updateVariant(modal);
  }

  // Dismiss the modal overlay and restore default browser scroll settings
  function closeModal(modal) {
    const modalInner = modal.querySelector('.custom-quick-view-modal');
    if (modalInner) modalInner.classList.remove('is-active');
    document.body.style.overflow = '';
  }

  // Show cart toast notification if the product is added to the cart successfully
  function showSuccessToast() {
    const toast = document.getElementById('custom-cart-toast');
    if (!toast) return;

    toast.classList.add('is-active');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('is-active');
    }, 4000);
  }

  // Update cart count in the header
  async function updateGlobalCartCount() {
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

  // Format price in cents to dollar format
  function formatMoney(cents) {
    if (typeof Shopify !== 'undefined' && Shopify.formatMoney) {
      return Shopify.formatMoney(cents);
    }
    return '$' + (cents / 100).toFixed(2);
  }

  // Initialize color indicator slider transitions
  function initColorSlider(container) {
    const radios = Array.from(container.querySelectorAll('input[type="radio"]'));
    const activeIdx = radios.findIndex((r) => r.checked);
    if (activeIdx !== -1) {
      container.style.setProperty('--active-index', activeIdx);
    }
  }

  // --- Global Event Delegation Listeners ---

  // Listen for click events globally
  document.addEventListener('click', (e) => {
    // 1. Open trigger
    const openTrigger = e.target.closest('.custom-product-card__quick-add-trigger');
    if (openTrigger) {
      e.preventDefault();
      const productId = openTrigger.getAttribute('data-product-id');
      const sectionId = openTrigger.getAttribute('data-section-id');
      const modal = document.getElementById('quick-view-' + sectionId + '-' + productId);
      if (modal) {
        openModal(modal);
      }
      return;
    }

    // Find if the click is within a custom-quick-view modal context
    const modal = e.target.closest('.custom-quick-view');
    if (!modal) return;

    // 2. Close triggers
    const closeTrigger = e.target.closest('.custom-quick-view-modal__close');
    const backdropTrigger = e.target.closest('.custom-quick-view-modal__backdrop');
    if (closeTrigger || backdropTrigger) {
      e.preventDefault();
      closeModal(modal);
      return;
    }

    // 3. Dropdown Trigger toggles
    const dropdownTrigger = e.target.closest('.custom-dropdown-select__trigger');
    if (dropdownTrigger) {
      e.stopPropagation();
      const dropdown = dropdownTrigger.closest('.custom-dropdown-select');
      modal.querySelectorAll('.custom-dropdown-select').forEach((other) => {
        if (other !== dropdown) other.classList.remove('is-open');
      });
      dropdown.classList.toggle('is-open');
      return;
    }

    // 4. Dropdown Option selections
    const optionEl = e.target.closest('.custom-dropdown-select__option');
    if (optionEl) {
      const dropdown = optionEl.closest('.custom-dropdown-select');
      const triggerText = dropdown.querySelector('.custom-dropdown-select__trigger-text');
      const group = optionEl.closest('.custom-option-group');
      const val = optionEl.getAttribute('data-value');

      triggerText.innerText = val;
      dropdown.classList.remove('is-open');

      dropdown.querySelectorAll('.custom-dropdown-select__option').forEach((el) => {
        el.classList.toggle('is-selected', el === optionEl);
      });

      const radio = group.querySelector(`input[type="radio"][value="${val}"]`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }

    // Close all dropdowns if clicking elsewhere inside the modal
    modal.querySelectorAll('.custom-dropdown-select').forEach((d) => d.classList.remove('is-open'));
  });

  // Close all dropdowns globally if clicking outside of any dropdown trigger
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-dropdown-select')) {
      document.querySelectorAll('.custom-dropdown-select').forEach((d) => d.classList.remove('is-open'));
    }
  });

  // Listen for Escape key globally to close popup automatically
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.custom-quick-view-modal.is-active');
      if (activeModal) {
        const modal = activeModal.closest('.custom-quick-view');
        if (modal) closeModal(modal);
      }
    }
  });

  // Listen for change events on forms
  document.addEventListener('change', (e) => {
    const form = e.target.closest('.custom-quick-view-form');
    if (form) {
      const modal = form.closest('.custom-quick-view');
      if (modal) {
        // If color slider changed, update its indicator layout position
        const colorContainer = e.target.closest('.custom-option-values--color');
        if (colorContainer) {
          initColorSlider(colorContainer);
        }
        updateVariant(modal);
      }
    }
  });

  // Listen for submit events on forms
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('.custom-quick-view-form');
    if (form) {
      e.preventDefault();
      const modal = form.closest('.custom-quick-view');
      if (modal) {
        const submitBtn = modal.querySelector('.custom-quick-view-submit');
        if (submitBtn && submitBtn.hasAttribute('disabled')) {
          return;
        }
        addToCart(modal);
      }
    }
  });

  // Setup color slider position on DOMContentLoaded (for default pre-selected swatches)
  function initAllColorSliders() {
    document.querySelectorAll('.custom-option-values--color').forEach((container) => {
      initColorSlider(container);
    });
    // Run variant updates initially for all products
    document.querySelectorAll('.custom-quick-view').forEach((modal) => {
      updateVariant(modal);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllColorSliders);
  } else {
    initAllColorSliders();
  }
})();
