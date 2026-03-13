const LEGEND_ITEMS = [
  { label: "0-34", color: "#31CF00" },
  { label: "35-52", color: "#FFFF00" },
  { label: "53-69", color: "#FF0000" },
  { label: "70+", color: "#CE30FF" }
];

export function createLegendControl(options) {
  const container = options.container;
  const toggleButton = options.toggleButton;

  let collapsed = false;

  function renderContent() {
    container.innerHTML = "";

    const list = document.createElement("ul");
    list.className = "legend-list";

    for (const item of LEGEND_ITEMS) {
      const row = document.createElement("li");
      row.className = "legend-row";

      const swatch = document.createElement("span");
      swatch.className = "legend-swatch";
      swatch.style.backgroundColor = item.color;

      const text = document.createElement("span");
      text.textContent = item.label;

      row.append(swatch, text);
      list.appendChild(row);
    }

    container.appendChild(list);
  }

  function sync() {
    toggleButton.setAttribute("aria-expanded", String(!collapsed));
    container.hidden = collapsed;
  }

  toggleButton.addEventListener("click", () => {
    collapsed = !collapsed;
    sync();
  });

  renderContent();
  sync();

  return {
    setCollapsed(next) {
      collapsed = next;
      sync();
    }
  };
}
