const PROCESSED_ATTR = "data-revealx-processed";
const POLL_INTERVAL_MS = 250;

function createRevealBadge() {
  const badge = document.createElement("div");
  badge.className = "revealx-badge";

  const text = document.createElement("span");
  text.className = "revealx-badge-text";
  badge.appendChild(text);

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "revealx-badge-copy";
  copyBtn.textContent = "Copy";
  badge.appendChild(copyBtn);

  return { badge, text, copyBtn };
}

function positionBadge(badge, input) {
  const rect = input.getBoundingClientRect();
  badge.style.left = `${window.scrollX + rect.left}px`;
  badge.style.top = `${window.scrollY + rect.bottom + 4}px`;
  badge.style.minWidth = `${rect.width}px`;
}

function attachRevealControl(input) {
  if (input.getAttribute(PROCESSED_ATTR)) return;
  input.setAttribute(PROCESSED_ATTR, "true");

  const wrapper = document.createElement("span");
  wrapper.className = "revealx-wrapper";
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const eyeBtn = document.createElement("button");
  eyeBtn.type = "button";
  eyeBtn.className = "revealx-eye-btn";
  eyeBtn.setAttribute("aria-label", "Reveal password value");
  eyeBtn.textContent = "👁";
  wrapper.appendChild(eyeBtn);

  const { badge, text, copyBtn } = createRevealBadge();
  document.body.appendChild(badge);

  let pollTimer = null;
  let visible = false;

  const refresh = () => {
    text.textContent = input.value.length ? input.value : "(empty)";
  };

  const show = () => {
    visible = true;
    eyeBtn.textContent = "🙈";
    refresh();
    positionBadge(badge, input);
    badge.classList.add("revealx-visible");
    pollTimer = setInterval(() => {
      refresh();
      positionBadge(badge, input);
    }, POLL_INTERVAL_MS);
  };

  const hide = () => {
    visible = false;
    eyeBtn.textContent = "👁";
    badge.classList.remove("revealx-visible");
    clearInterval(pollTimer);
  };

  eyeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    visible ? hide() : show();
  });

  copyBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(input.value);
      copyBtn.textContent = "Copied!";
      setTimeout(hide, 1000);
    } catch {
      copyBtn.textContent = "Failed";
      setTimeout(() => (copyBtn.textContent = "Copy"), 900);
    }
  });

  input.addEventListener("input", () => visible && refresh());

  document.addEventListener("click", (e) => {
    if (visible && !badge.contains(e.target) && e.target !== eyeBtn) hide();
  });

  document.addEventListener("keydown", (e) => {
    if (visible && e.key === "Escape") hide();
  });

  window.addEventListener("scroll", () => visible && positionBadge(badge, input), true);
  window.addEventListener("resize", () => visible && positionBadge(badge, input));

  // Field can disappear from under us (collapsed panels, SPA route changes),
  // so the badge needs its own teardown rather than leaking a floating div.
  new MutationObserver((_, observer) => {
    if (!document.body.contains(input)) {
      hide();
      badge.remove();
      observer.disconnect();
    }
  }).observe(document.body, { childList: true, subtree: true });
}

function findPasswordFields(root) {
  if (!root.querySelectorAll) return;

  root.querySelectorAll('input[type="password"]').forEach(attachRevealControl);

  // Open shadow roots are invisible to a plain querySelectorAll, so walk into
  // them explicitly. Closed shadow roots are unreachable by design, nothing
  // to do about those.
  root.querySelectorAll("*").forEach((el) => {
    if (el.shadowRoot) findPasswordFields(el.shadowRoot);
  });
}

function watchForNewFields(root) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.('input[type="password"]')) attachRevealControl(node);
        findPasswordFields(node);
        if (node.shadowRoot) watchForNewFields(node.shadowRoot);
      });
    }
  });
  observer.observe(root, { childList: true, subtree: true });
}

findPasswordFields(document);
watchForNewFields(document.documentElement);

document.querySelectorAll("*").forEach((el) => {
  if (el.shadowRoot) watchForNewFields(el.shadowRoot);
});
