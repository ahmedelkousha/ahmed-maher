// @ts-nocheck

/*
 * Product Quick View & Dynamic Cart Manager

 * We wrap all our code inside a function wrapper (IIFE) to keep our variables private 
   and avoid conflicting with any other scripts on the shop.

 * Instead of adding event listeners to every single button (which slows down the browser),
   we use a single global listener on the document level (Event Delegation) to catch clicks and changes.

 */
(function () {
  // Keeps track of the cart toast auto-hide timer
  let toastTimeout = null;

  /*
   * Checks the selected color and size options, finds the matching variant, 
     and updates the modal's price, stock availability, and the add to cart button.
   
     */
  function updateVariant(modal) {
    // Get the product variants array stored on the modal's data attribute
    const variants = JSON.parse(modal.dataset.variants || '[]');
    if (variants.length === 0) return;

    // Get all the key elements inside this modal
    const form = modal.querySelector('.custom-quick-view-form');
    const submitBtn = modal.querySelector('.custom-quick-view-submit');
    const idInput = modal.querySelector('input[name="id"]');
    const priceEl = modal.querySelector('.custom-quick-view__price');
    const comparePriceEl = modal.querySelector('.custom-quick-view__compare-price');

    const numOptions = variants[0].options.length;
    const selectedOptions = new Array(numOptions);

    // Look at each option group (like Color or Size) to see what is currently selected
    let missingSelectionName = null;
    modal.querySelectorAll('.custom-option-group').forEach((group) => {
      const optIdx = parseInt(group.getAttribute('data-option-index'), 10);
      const checkedRadio = group.querySelector('input[type="radio"]:checked');

      if (checkedRadio) {
        selectedOptions[optIdx] = checkedRadio.value;
      } else {
        // If the user hasn't selected a value (e.g. haven't chosen a size yet)
        const label = group.querySelector('.custom-option-label');
        missingSelectionName = label ? label.innerText.replace(':', '').trim() : 'Option';
      }
    });

    // If there is a missing selection (like Size), disable the button but keep text as Add to Cart
    if (missingSelectionName) {
      submitBtn.setAttribute('disabled', 'true');
      const btnText = modal.querySelector('.custom-submit-text');
      if (btnText) btnText.innerText = 'Add to Cart';
      const btnArrow = modal.querySelector('.custom-submit-arrow');
      if (btnArrow) btnArrow.style.display = ''; // Keep the arrow visible
      return;
    }

    // Search the variants list to find the one matching the chosen options
    const variant = variants.find((v) => {
      return v.options.every((opt, idx) => opt === selectedOptions[idx]);
    });

    if (variant) {
      // Sync the hidden form input with the selected variant's ID
      idInput.value = variant.id;
      idInput.disabled = !variant.available;

      // Update the main Add to Cart button based on stock
      if (variant.available) {
        submitBtn.removeAttribute('disabled');
        const btnText = modal.querySelector('.custom-submit-text');
        if (btnText) btnText.innerText = 'Add to Cart';
        const btnArrow = modal.querySelector('.custom-submit-arrow');
        if (btnArrow) btnArrow.style.display = '';
      } else {
        // Out of stock
        submitBtn.setAttribute('disabled', 'true');
        const btnText = modal.querySelector('.custom-submit-text');
        if (btnText) btnText.innerText = 'Sold Out';
        const btnArrow = modal.querySelector('.custom-submit-arrow');
        if (btnArrow) btnArrow.style.display = 'none';
      }

      // Update the price display
      if (priceEl) {
        priceEl.innerHTML = formatMoney(variant.price);
      }

      // If there's a compare-at price (on-sale item), display the original price crossed out
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
      // If the selected combination doesn't exist
      submitBtn.setAttribute('disabled', 'true');
      const btnText = modal.querySelector('.custom-submit-text');
      if (btnText) btnText.innerText = 'Unavailable';
      const btnArrow = modal.querySelector('.custom-submit-arrow');
      if (btnArrow) btnArrow.style.display = 'none';
    }
  }

  /*
   * Adds the selected variant to the cart using Shopify's AJAX API.

   */
  async function addToCart(modal) {
    const submitBtn = modal.querySelector('.custom-quick-view-submit');
    if (submitBtn && submitBtn.hasAttribute('disabled')) return;

    const idInput = modal.querySelector('input[name="id"]');
    const variantId = idInput.value;
    if (!variantId) return;

    // Show a loading spinner and set text to "Adding..."
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

    // Grab the chosen options to see if we should trigger the jacket promo
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

    // Promo rule: If Black and Medium are chosen, automatically bundle the Soft Winter Jacket (ID: 56764156051622)
    if (hasBlack && hasMedium) {
      items.push({
        id: 56764156051622,
        quantity: 1,
      });
    }

    try {
      const rootPath = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

      // Post item(s) to the Shopify AJAX cart add endpoint
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
        // Success: show success toast, update cart bubbles in header, and close the modal
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
      // Re-enable the button and restore original state
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

  /*
   * Resets all selections in the modal back to their initial unselected defaults.
     This ensures opening a modal doesn't show old selections from the last product.

     */
  function resetModal(modal) {
    const form = modal.querySelector('.custom-quick-view-form');
    if (form) {
      form.reset(); // Resets all native inputs (radios, hidden fields) back to initial load states
    }

    // Reset custom size dropdowns labels and selection outlines
    modal.querySelectorAll('.custom-option-group').forEach((group) => {
      const label = group.querySelector('.custom-option-label');
      const optionName = label ? label.innerText.replace(':', '').trim().toLowerCase() : 'size';

      const dropdown = group.querySelector('.custom-dropdown-select');
      if (dropdown) {
        const triggerText = dropdown.querySelector('.custom-dropdown-select__trigger-text');
        if (triggerText) {
          triggerText.innerText = 'Choose your ' + optionName;
        }
        dropdown.classList.remove('has-selected');
        dropdown.querySelectorAll('.custom-dropdown-select__option').forEach((opt) => {
          opt.classList.remove('is-selected');
        });
      }

      // Reset the sliding background indicators for color options
      const colorContainer = group.querySelector('.custom-option-values--color');
      if (colorContainer) {
        initColorSlider(colorContainer);
      }
    });
  }

  /*
   * Opens the quick view modal and locks the main body scroll.

     */
  function openModal(modal) {
    resetModal(modal); // Reset options first
    const modalInner = modal.querySelector('.custom-quick-view-modal');
    if (modalInner) modalInner.classList.add('is-active');
    document.body.style.overflow = 'hidden';
    updateVariant(modal);
  }

  /*
   * Closes the quick view modal and unlocks body scroll.

      */
  function closeModal(modal) {
    const modalInner = modal.querySelector('.custom-quick-view-modal');
    if (modalInner) modalInner.classList.remove('is-active');
    document.body.style.overflow = '';
  }

  /*
   * Displays the added-to-cart success toast, hiding it automatically after 4 seconds.

   */
  function showSuccessToast() {
    const toast = document.getElementById('custom-cart-toast');
    if (!toast) return;

    toast.classList.add('is-active');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('is-active');
    }, 4000);
  }

  /*
   * Fetches latest cart state and updates cart count bubbles in the header.

   */
  async function updateGlobalCartCount() {
    try {
      const rootPath = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
      const response = await fetch(rootPath + 'cart.js');
      const cart = await response.json();

      // Find standard theme cart counters and update them
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

  /*
   * Formats a raw price in cents into a dollar format (e.g. 1999 -> $19.99).

   */
  function formatMoney(cents) {
    if (typeof Shopify !== 'undefined' && Shopify.formatMoney) {
      return Shopify.formatMoney(cents);
    }
    return '$' + (cents / 100).toFixed(2);
  }

  /*
   * Positions the colored indicator block on swatches.
  
   */
  function initColorSlider(container) {
    const radios = Array.from(container.querySelectorAll('input[type="radio"]'));
    const activeIdx = radios.findIndex((r) => r.checked);
    if (activeIdx !== -1) {
      container.style.setProperty('--active-index', activeIdx);
    }
  }

  // --- Global Event Delegation Listeners ---

  // Handle all click events on the page
  document.addEventListener('click', (e) => {
    // 1. Plus trigger click (Open Quick View)
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

    // Verify if click is inside a quick-view modal
    const modal = e.target.closest('.custom-quick-view');
    if (!modal) return;

    // 2. Close modal triggers (backdrop overlay or 'X' button)
    const closeTrigger = e.target.closest('.custom-quick-view-modal__close');
    const backdropTrigger = e.target.closest('.custom-quick-view-modal__backdrop');
    if (closeTrigger || backdropTrigger) {
      e.preventDefault();
      closeModal(modal);
      return;
    }

    // 3. Size dropdown toggle click
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

    // 4. Dropdown option select click
    const optionEl = e.target.closest('.custom-dropdown-select__option');
    if (optionEl) {
      const dropdown = optionEl.closest('.custom-dropdown-select');
      const triggerText = dropdown.querySelector('.custom-dropdown-select__trigger-text');
      const group = optionEl.closest('.custom-option-group');
      const val = optionEl.getAttribute('data-value');

      triggerText.innerText = val;
      dropdown.classList.remove('is-open');
      dropdown.classList.add('has-selected');

      dropdown.querySelectorAll('.custom-dropdown-select__option').forEach((el) => {
        el.classList.toggle('is-selected', el === optionEl);
      });

      // Check the hidden native radio input and trigger a 'change' event to update price
      const radio = group.querySelector(`input[type="radio"][value="${val}"]`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }

    // Close any open dropdowns if clicking elsewhere inside the modal bounds
    modal.querySelectorAll('.custom-dropdown-select').forEach((d) => d.classList.remove('is-open'));
  });

  // Close all open dropdown menus if clicking outside of the selector completely
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-dropdown-select')) {
      document.querySelectorAll('.custom-dropdown-select').forEach((d) => d.classList.remove('is-open'));
    }
  });

  // Escape key listener to close active modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.custom-quick-view-modal.is-active');
      if (activeModal) {
        const modal = activeModal.closest('.custom-quick-view');
        if (modal) closeModal(modal);
      }
    }
  });

  // Listen for swatches / dropdown selection change events
  document.addEventListener('change', (e) => {
    const form = e.target.closest('.custom-quick-view-form');
    if (form) {
      const modal = form.closest('.custom-quick-view');
      if (modal) {
        const colorContainer = e.target.closest('.custom-option-values--color');
        if (colorContainer) {
          initColorSlider(colorContainer);
        }
        updateVariant(modal);
      }
    }
  });

  // Listen for Add to Cart form submissions
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('.custom-quick-view-form');
    if (form) {
      e.preventDefault();
      const modal = form.closest('.custom-quick-view');
      if (modal) {
        // Stop submission if the button is disabled (size not chosen)
        const submitBtn = modal.querySelector('.custom-quick-view-submit');
        if (submitBtn && submitBtn.hasAttribute('disabled')) {
          return;
        }
        addToCart(modal);
      }
    }
  });

  // Set default swatch indicators and price states on page load
  function initAllColorSliders() {
    document.querySelectorAll('.custom-option-values--color').forEach((container) => {
      initColorSlider(container);
    });
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
