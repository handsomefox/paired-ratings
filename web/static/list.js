(() => {
  const toggle = document.querySelector("[data-filter-toggle]");
  const panel = document.querySelector("[data-filters-panel]");
  const close = panel?.querySelector("[data-filter-close]");
  const form = panel?.querySelector("form");
  if (!toggle || !panel) return;
  const menus = Array.from(document.querySelectorAll("[data-menu]"));
  const confirmModal = document.querySelector("[data-confirm-modal]");
  const confirmBackdrop = document.querySelector("[data-confirm-backdrop]");
  const confirmCancel = document.querySelector("[data-confirm-cancel]");
  const confirmDelete = document.querySelector("[data-confirm-delete]");
  let pendingDeleteForm = null;

  const requestSubmit = () => {
    if (!form) return;
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return;
    }
    form.submit();
  };

  const openPanel = () => {
    panel.classList.add("is-open");
  };

  const closePanel = () => {
    panel.classList.remove("is-open");
  };

  toggle.addEventListener("click", openPanel);
  close?.addEventListener("click", closePanel);

  let submitTimer = null;
  const scheduleSubmit = (delay) => {
    if (!form) return;
    if (submitTimer) clearTimeout(submitTimer);
    submitTimer = setTimeout(() => {
      closePanel();
      requestSubmit();
    }, delay);
  };

  form?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.tagName === "SELECT" || target.tagName === "INPUT") {
      scheduleSubmit(0);
    }
  });

  form?.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (
      target.tagName === "INPUT" &&
      target.getAttribute("type") === "number"
    ) {
      scheduleSubmit(300);
    }
  });

  const closeMenus = () => {
    menus.forEach((menu) => {
      menu.classList.remove("is-open");
      const button = menu.querySelector("[data-menu-button]");
      if (button) button.setAttribute("aria-expanded", "false");
    });
  };

  menus.forEach((menu) => {
    const button = menu.querySelector("[data-menu-button]");
    if (!button) return;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = menu.classList.contains("is-open");
      closeMenus();
      if (!isOpen) {
        menu.classList.add("is-open");
        button.setAttribute("aria-expanded", "true");
      }
    });
  });

  const openConfirm = (form) => {
    if (!confirmModal || !confirmBackdrop) return;
    pendingDeleteForm = form;
    confirmBackdrop.style.display = "block";
    confirmModal.style.display = "grid";
  };

  const closeConfirm = () => {
    if (!confirmModal || !confirmBackdrop) return;
    confirmBackdrop.style.display = "none";
    confirmModal.style.display = "none";
    pendingDeleteForm = null;
  };

  document.querySelectorAll("[data-delete-form]").forEach((deleteForm) => {
    deleteForm.addEventListener("submit", (event) => {
      event.preventDefault();
      openConfirm(deleteForm);
    });
  });

  confirmCancel?.addEventListener("click", closeConfirm);
  confirmBackdrop?.addEventListener("click", closeConfirm);
  confirmDelete?.addEventListener("click", () => {
    if (pendingDeleteForm) pendingDeleteForm.submit();
    closeConfirm();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePanel();
      closeMenus();
      closeConfirm();
    }
  });

  document.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement) {
      if (event.target.closest("[data-menu]")) return;
    }
    closeMenus();
  });
})();
