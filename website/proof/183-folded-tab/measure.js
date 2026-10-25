(() => {
  const tab = document.querySelector(".al-quests-tab");
  if (!tab) return JSON.stringify({ tab: null, panel: !!document.querySelector(".al-quests-panel") });
  const t = tab.getBoundingClientRect();
  const visibleRight = (el) => {
    let right = el.getBoundingClientRect().right;
    for (let box = el.parentElement; box && box !== document.body; box = box.parentElement) {
      if (getComputedStyle(box).overflowX !== "visible") right = Math.min(right, box.getBoundingClientRect().right);
    }
    return right;
  };
  const controls = [...document.querySelectorAll(".al-main :is(a[href], button, input, select, textarea, [role=button], [role=tab], [tabindex]:not([tabindex='-1']))")]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; })
    .map((el) => ({ el, r: el.getBoundingClientRect(), right: visibleRight(el) }))
    .filter(({ r, right }) => right > t.left && r.left < right);
  return JSON.stringify({ tabLeft: Math.round(t.left), tabTop: Math.round(t.top), tabBottom: Math.round(t.bottom), underTabColumn: controls.map(({ el, r, right }) => ({ name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30), left: Math.round(r.left), right: Math.round(right), top: Math.round(r.top + scrollY) })) });
})()
