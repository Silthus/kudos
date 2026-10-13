(function () {
  var stored = null;
  try {
    stored = window.localStorage.getItem("hedgehug.theme");
  } catch (refused) {}
  var dark = stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
})();
