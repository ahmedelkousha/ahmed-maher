(function () {
  // Set up event listeners for a single Top Bar menu, enabling toggle actions on mobile viewports
  function initSingleTopBar(sectionEl) {
    var toggleBtn = sectionEl.querySelector('.custom-top-bar__hamburger-btn');
    var dropdown = sectionEl.querySelector('.custom-top-bar__mobile-dropdown');

    // Attach click listeners to expand/collapse the mobile menu drawer
    if (toggleBtn && dropdown) {
      toggleBtn.removeEventListener('click', toggleMenu);
      toggleBtn.addEventListener('click', toggleMenu);
    }

    // Toggle CSS classes to transition the hamburger icon into an 'X' and slide the dropdown open
    function toggleMenu() {
      var isOpen = dropdown.classList.toggle('is-open');
      toggleBtn.classList.toggle('is-active', isOpen);
    }
  }

  // Find all top bar sections on the page and initialize their menu behaviors
  function initAllTopBars() {
    var topBars = document.querySelectorAll('.custom-top-bar-section');
    topBars.forEach(function (topBar) {
      initSingleTopBar(topBar);
    });
  }

  // Fire initialization once the DOM elements are fully loaded and parsed by the browser
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllTopBars);
  } else {
    initAllTopBars();
  }

  // Re-run initialization when Shopify's Theme Editor reloads the section preview dynamically
  document.addEventListener('shopify:section:load', function (event) {
    if (event.target && event.target.querySelector) {
      var topBar = event.target.querySelector('.custom-top-bar-section');
      if (topBar) {
        initSingleTopBar(topBar);
      }
    }
  });
})();
