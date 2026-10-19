/* harness.js — общий загрузчик index.html в jsdom для проверок.
   Использование:
     const { createApp } = require("./harness");
     const app = createApp(); // { dom, window, document, logs, errors, alerts, close }
*/
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const HTML_PATH = path.join(__dirname, "..", "index.html");

function createApp(opts = {}) {
  const html = fs.readFileSync(HTML_PATH, "utf8");
  const logs = [];
  const errors = [];
  const alerts = [];

  const dom = new JSDOM(html, {
    url: opts.url || "https://unitest.local/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.console.log = (...a) => logs.push(a.map(String).join(" "));
      window.console.error = (...a) => errors.push(a.map(String).join(" "));
      window.alert = (m) => alerts.push(String(m));
      window.confirm = () => true;
      if (opts.fakeTimers) {
        window.setInterval = () => 1;
        window.clearInterval = () => {};
        window.setTimeout = (fn) => { try { fn(); } catch (e) { errors.push(String(e)); } return 1; };
      }
    }
  });

  const w = dom.window;
  const d = w.document;
  // jsdom откладывает DOMContentLoaded: приложение инициализируем вручную
  if (d.readyState === "loading") w.initApp();

  return {
    dom, window: w, document: d, logs, errors, alerts,
    eval: (expr) => w.eval(expr),
    close: () => dom.window.close()
  };
}

module.exports = { createApp, HTML_PATH };
