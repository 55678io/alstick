// Shared layout for signed-in pages: header (burger menu + logo), left menu, footer,
// notification opt-in and log out.
(function () {
  const page = location.pathname.split("/").pop() || "home.html";

  const MENU = [
    { label: "Home", href: "home.html" },
    { label: "Today's Report", href: "dailyreport.html" },
    { label: "Weekly Report", href: "weeklyreport.html" },
    { label: "Monthly Report", href: "monthlyreport.html" },
  ];

  // Header
  const header = document.createElement("header");
  header.innerHTML =
    '<a href="home.html" aria-label="Home"><img class="brand" src="Boku.jpeg" alt="Alstick"></a>' +
    '<button class="menu-btn" id="menuBtn" aria-label="Open menu" aria-controls="drawer" aria-expanded="false"><span></span><span></span><span></span></button>';
  document.body.prepend(header);
  header.querySelector(".brand").onerror = function () {
    const t = document.createElement("span");
    t.className = "brand-text";
    t.textContent = "Alstick";
    this.replaceWith(t);
  };

  // Footer
  const footer = document.createElement("footer");
  footer.textContent = "© " + new Date().getFullYear() + " Alstick";
  document.body.append(footer);

  // Left side menu
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  const drawer = document.createElement("nav");
  drawer.className = "drawer";
  drawer.id = "drawer";
  drawer.setAttribute("aria-label", "Menu");
  drawer.innerHTML =
    '<div class="drawer-head">Menu</div>' +
    MENU.map(m => '<a class="menu-item' + (m.href === page ? " active" : "") + '" href="' + m.href + '">' + m.label + "</a>").join("") +
    '<button class="menu-item" id="notify"><span>Enable notifications</span><span class="check" aria-hidden="true">&#10003;</span></button>' +
    '<button class="menu-item logout" id="logout">Log out</button>' +
    '<div id="status"></div>';
  document.body.append(overlay, drawer);

  const menuBtn = document.getElementById("menuBtn");
  const setMenu = open => {
    document.body.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
  };
  menuBtn.onclick = () => setMenu(!document.body.classList.contains("menu-open"));
  overlay.onclick = () => setMenu(false);

  // Log out
  document.getElementById("logout").onclick = () => {
    sessionStorage.removeItem("alstick_ok");
    location.replace("index.html");
  };

  // Notifications
  const status = document.getElementById("status");
  const btn = document.getElementById("notify");
  const say = t => { status.textContent = t; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const markOn = () => { btn.classList.add("on"); say(""); };
  window.OneSignalDeferred = window.OneSignalDeferred || [];

  // Show the check mark if this device is already subscribed
  window.OneSignalDeferred.push(async OneSignal => {
    const ps = OneSignal.User.PushSubscription;
    if ("Notification" in window && Notification.permission === "granted" && ps.optedIn) markOn();
    ps.addEventListener("change", e => { if (e.current && e.current.optedIn) markOn(); });
  });

  function subscribe() {
    window.OneSignalDeferred.push(async OneSignal => {
      try {
        if (window.__osError) { say("Something went wrong. Please try again."); return; }
        await OneSignal.User.PushSubscription.optIn();
        // The subscription ID can take a few seconds to arrive from the server
        for (let i = 0; i < 15 && !(OneSignal.User.PushSubscription.id && OneSignal.User.PushSubscription.token); i++) await sleep(1000);
        if (OneSignal.User.PushSubscription.id && OneSignal.User.PushSubscription.token) markOn();
        else say("Something went wrong. Please try again.");
      } catch (e) {
        console.error(e);
        say("Something went wrong. Please try again.");
      }
    });
  }

  btn.onclick = async () => {
    say("");
    if (!("Notification" in window)) {
      const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const standalone = window.navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
      if (iOS && !standalone) say("On iPhone: tap Share, then \"Add to Home Screen,\" and open Alstick from your Home Screen.");
      else say("This browser doesn't support notifications.");
      return;
    }
    let perm = Notification.permission;
    // Permission must be requested directly from the click (required by Safari)
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm === "granted") subscribe();
    else if (perm === "denied") say("Notifications are blocked. Allow them for this site in your browser settings.");
  };
})();
