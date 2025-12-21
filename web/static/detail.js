(() => {
  const form = document.querySelector("[data-rating-form]");
  if (!form) return;
  const saveButton = form.querySelector("[data-save-button]");
  if (!saveButton) return;
  const commentEdits = form.querySelectorAll("[data-comment-edit]");
  const deleteButton = form.querySelector("[data-delete-button]");
  const confirmModal = document.querySelector("[data-confirm-modal]");
  const confirmBackdrop = document.querySelector("[data-confirm-backdrop]");
  const confirmCancel = document.querySelector("[data-confirm-cancel]");
  const confirmDelete = document.querySelector("[data-confirm-delete]");

  const init = {
    bfRating: form.dataset.initBfRating || "",
    gfRating: form.dataset.initGfRating || "",
    bfComment: (form.dataset.initBfComment || "").trim(),
    gfComment: (form.dataset.initGfComment || "").trim(),
  };

  const currentState = () => {
    const bfRating =
      form.querySelector('input[name="bf_rating"]:checked')?.value || "";
    const gfRating =
      form.querySelector('input[name="gf_rating"]:checked')?.value || "";
    const bfComment = (
      form.querySelector('textarea[name="bf_comment"]')?.value || ""
    ).trim();
    const gfComment = (
      form.querySelector('textarea[name="gf_comment"]')?.value || ""
    ).trim();
    return { bfRating, gfRating, bfComment, gfComment };
  };

  const isDirty = () => {
    const current = currentState();
    return (
      current.bfRating !== init.bfRating ||
      current.gfRating !== init.gfRating ||
      current.bfComment !== init.bfComment ||
      current.gfComment !== init.gfComment
    );
  };

  const updateButton = () => {
    saveButton.disabled = !isDirty();
  };

  form.addEventListener("input", updateButton);
  form.addEventListener("change", updateButton);

  const openConfirm = () => {
    if (!confirmModal || !confirmBackdrop) return;
    confirmBackdrop.style.display = "block";
    confirmModal.style.display = "grid";
  };

  const closeConfirm = () => {
    if (!confirmModal || !confirmBackdrop) return;
    confirmBackdrop.style.display = "none";
    confirmModal.style.display = "none";
  };

  const submitDelete = () => {
    if (!deleteButton) return;
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit(deleteButton);
      return;
    }
    const deleteAction = deleteButton.getAttribute("formaction");
    if (deleteAction) {
      const prevAction = form.getAttribute("action");
      form.setAttribute("action", deleteAction);
      form.submit();
      if (prevAction === null) {
        form.removeAttribute("action");
      } else {
        form.setAttribute("action", prevAction);
      }
      return;
    }
    form.submit();
  };

  deleteButton?.addEventListener("click", (event) => {
    if (!confirmModal || !confirmBackdrop) return;
    event.preventDefault();
    openConfirm();
  });

  confirmCancel?.addEventListener("click", closeConfirm);
  confirmBackdrop?.addEventListener("click", closeConfirm);
  confirmDelete?.addEventListener("click", () => {
    submitDelete();
    closeConfirm();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeConfirm();
  });

  commentEdits.forEach((button) => {
    button.addEventListener("click", () => {
      const container = button.closest(".rating-card");
      if (!container) return;
      const display = container.querySelector("[data-comment-display]");
      const editor = container.querySelector("[data-comment-editor]");
      if (!editor || !display) return;
      display.classList.add("is-hidden");
      editor.classList.remove("is-hidden");
      editor.focus();
    });
  });

  updateButton();
})();
