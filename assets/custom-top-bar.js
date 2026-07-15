// @ts-nocheck

/*
 * Mobile Top Bar Hamburger Menu Handler
 
 * We wrap our code in a function (IIFE) to keep variables private and prevent 
   conflicts with other scripts.

 * This script handles opening and closing the mobile navigation drawer 
   when clicking the hamburger menu button.
   
 */
(function () {

  // Sets up the click listener for a single top bar's mobile menu
  function initSingleTopBar(sectionEl) {
    var toggleBtn = sectionEl.querySelector('.custom-top-bar__hamburger-btn');
    var dropdown = sectionEl.querySelector('.custom-top-bar__mobile-dropdown');

    if (toggleBtn && dropdown) {
      // Remove any existing click listener first to prevent double-binding, then add it
      toggleBtn.removeEventListener('click', toggleMenu);
      toggleBtn.addEventListener('click', toggleMenu);
    }

    // Toggles the dropdown menu drawer open/closed and updates the hamburger icon shape
    function toggleMenu() {
      var isOpen = dropdown.classList.toggle('is-open');
      toggleBtn.classList.toggle('is-active', isOpen);
    }
  }

  // Find all top bars in the page and set them up
  function initAllTopBars() {
    var topBars = document.querySelectorAll('.custom-top-bar-section');
    topBars.forEach(function (topBar) {
      initSingleTopBar(topBar);
    });
  }

  // Run the initialization once the browser is ready and elements are loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllTopBars);
  } else {
    initAllTopBars();
  }

  // Re-run setup whenever Shopify's Theme Editor reloads/customizes the section preview
  document.addEventListener('shopify:section:load', function (event) {
    if (event.target && event.target.querySelector) {
      var topBar = event.target.querySelector('.custom-top-bar-section');
      if (topBar) {
        initSingleTopBar(topBar);
      }
    }
  });
})();
