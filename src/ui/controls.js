function firstToken(value) {
  return value.trim().split(/\s+/)[0];
}

export function createFilterControls(options) {
  const container = options.container;
  const onSelectionChange = options.onSelectionChange ?? (() => {});
  const initialTypes = new Set(options.initialTypes ?? []);

  let selectedTypes = new Set();
  let entries = [];
  let initialized = false;

  function render() {
    container.innerHTML = "";

    for (const entry of entries) {
      const row = document.createElement("label");
      row.className = "control-row";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "sensor-type";
      input.value = entry.type;
      input.checked = selectedTypes.has(entry.type);
      input.addEventListener("change", () => {
        if (input.checked) {
          selectedTypes.add(entry.type);
        } else {
          selectedTypes.delete(entry.type);
        }
        onSelectionChange(new Set(selectedTypes));
      });

      const dot = document.createElement("span");
      dot.className = "control-dot";
      dot.style.backgroundColor = entry.previewColor;

      const name = document.createElement("span");
      name.className = "control-name";
      name.textContent = entry.type;

      const count = document.createElement("span");
      count.className = "control-count";
      count.textContent = String(entry.count);

      row.append(input, dot, name, count);
      container.appendChild(row);
    }
  }

  return {
    setTypes(typeList) {
      entries = [...typeList].sort((a, b) => a.type.localeCompare(b.type));

      const previous = new Set(selectedTypes);
      selectedTypes = new Set();

      for (const entry of entries) {
        if (previous.has(entry.type)) {
          selectedTypes.add(entry.type);
          continue;
        }

        if (
          !initialized &&
          (initialTypes.size === 0 ||
            initialTypes.has(entry.type) ||
            initialTypes.has(firstToken(entry.type)))
        ) {
          selectedTypes.add(entry.type);
        }
      }

      render();
      initialized = true;
      onSelectionChange(new Set(selectedTypes));
    },
    getSelectedTypes() {
      return new Set(selectedTypes);
    }
  };
}

export function wireMobilePanels(options) {
  const toggleButton = options.toggleButton;
  const panels = options.panels;

  let open = false;

  function sync() {
    toggleButton.setAttribute("aria-expanded", String(open));
    for (const panel of panels) {
      panel.classList.toggle("is-mobile-open", open);
    }
  }

  function setOpen(next) {
    open = next;
    sync();
  }

  toggleButton.addEventListener("click", () => {
    setOpen(!open);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setOpen(false);
    }
  });

  sync();

  return {
    open: () => setOpen(true),
    close: () => setOpen(false)
  };
}
