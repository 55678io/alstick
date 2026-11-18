// Loads the report numbers from the editable block at the top of index.html,
// so changing them there updates every page. Falls back to the defaults below.
(function () {
  const DEFAULTS = { reportFor: "Virgil Weber", hacker: 189, virus: 156, securityLevel: 24, attempts: 2115 };
  let d = Object.assign({}, DEFAULTS);
  try {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "index.html?data=" + Date.now(), false); // small file; always fresh
    xhr.send();
    if (xhr.status === 200) {
      const m = xhr.responseText.match(/<script id="alstick-data" type="application\/json">([\s\S]*?)<\/script>/);
      if (m) Object.assign(d, JSON.parse(m[1]));
    }
  } catch (e) {
    console.warn("Could not read numbers from index.html, using defaults", e);
  }
  const num = v => (Number.isFinite(+v) ? +v : 0);

  window.ALSTICK_REPORT_FOR = String(d.reportFor || "");
  window.ALSTICK_STATS = {
    H:  { label: "Number of Hacker",   value: num(d.hacker) },
    V:  { label: "Number of Virus",    value: num(d.virus) },
    SL: { label: "S L",                value: num(d.securityLevel), unit: "%" },
    A:  { label: "Number of attempts", value: num(d.attempts) },
  };
})();
