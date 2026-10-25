(() => {
  const all = [...document.querySelectorAll(".al-main button")].find((b) => b.textContent.trim() === "All time");
  const r = all.getBoundingClientRect();
  const hit = document.elementFromPoint(r.right - 4, r.top + r.height / 2);
  return JSON.stringify({ tab: !!document.querySelector(".al-quests-tab"), rightEdgeHits: all.contains(hit) ? "All time" : hit?.closest("button")?.getAttribute("aria-label") ?? hit?.className });
})()
