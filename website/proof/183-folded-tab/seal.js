(() => {
  scrollTo(0, document.body.scrollHeight);
  const seal = document.querySelector(".al-seal-spot button") ?? document.querySelector(".al-seal-spot");
  const tab = document.querySelector(".al-quests-tab").getBoundingClientRect();
  const r = seal.getBoundingClientRect();
  const y = Math.min(Math.max(r.top + 4, tab.top + 4), r.bottom - 4);
  const hit = document.elementFromPoint(r.right - 2, y);
  return JSON.stringify({ sealRight: Math.round(r.right), tabLeft: Math.round(tab.left), hitsTab: !!hit?.closest(".al-quests-tab") });
})()
