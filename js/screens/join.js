/*
  Entra in una stanza con il codice di 4 lettere.
*/

import { el } from "../utils.js";
import { setScreen } from "../state.js";
import { show, statusLine, setStatus } from "../ui.js";
import { joinRoom } from "../room.js";
import { showHome } from "./home.js";

export function showJoin() {
  setScreen("join");
  const codeInput = el("input", {
    type: "text",
    class: "code",
    maxlength: "4",
    placeholder: "CODICE",
    autocomplete: "off",
    autocapitalize: "characters",
  });
  const status = statusLine();

  const joinBtn = el("button", { text: "Entra" });
  joinBtn.addEventListener("click", async () => {
    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
      setStatus("Il codice ha 4 lettere.", true);
      return;
    }
    joinBtn.disabled = true;
    setStatus("Mi collego…");
    try {
      await joinRoom(code);
    } catch (err) {
      joinBtn.disabled = false;
      setStatus(err.message, true);
    }
  });

  show(
    el("h2", { text: "Entra in una stanza" }),
    el("p", { text: "Chiedi il codice a chi ha creato la stanza" }),
    el("div", { class: "card" }, [codeInput, joinBtn]),
    status,
    el("div", { class: "spacer" }),
    el("button", { text: "Indietro", class: "secondary", onclick: () => showHome() })
  );
  setTimeout(() => codeInput.focus(), 50);
}
