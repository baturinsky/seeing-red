<script>
  import { onMount, afterUpdate, tick } from "svelte";
  import { Game, toggleLanguage } from "./Game";
  import FontFaceObserver from "fontfaceobserver";
  import { log as logStorage, lang as langStorage } from "./store.js";

  let icons = new FontFaceObserver("Icons");

  let conf = {};
  let hash = location.hash;

  let regex = /[?&]([^=#]+)=([^&#]*)/g;
  let url = window.location.href;
  let match;
  let game;
  let gameDiv;
  let gameLog;
  let menuDiv;
  let winDiv;
  let tooltip;
  let lettersLogged = 0;
  let menu = false;
  let winText;
  let log;
  let lang;

  logStorage.subscribe(value => {
    log = value;
    lettersLogged = 0;
    if (gameLog) gameLog.scrollTop = 1e6;
  });

  langStorage.subscribe(value => {
    lang = value;
    log = log;
  });

  function translated(s) {
    let text = lang[s[0]];
    if (!text) return "-";
    if (s.length > 0) {
      for (let i in s) text = text.replace("{" + (i - 1) + "}", s[i]);
    }
    return text;
  }

  while ((match = regex.exec(url))) {
    try {
      conf[match[1]] = JSON.parse(match[2]);
    } catch (e) {
      console.log("what is " + match[1] + "?");
    }
  }

  icons.load().then(() => {
    game = new Game();
    game.onEnd = gameOver;
    game.init([45, 45]);
    if (game.hasSave("0")) {
      game.load("0");
    } else {
      game.start(conf);
    }
    gameLog.style.height = gameDiv.clientHeight + "px";
    toggleMenu(true);
  });

  onMount(async () => {
    setInterval(() => {
      if (log && log.length > 0) {
        let last = translated(log[log.length - 1]);
        if (last && lettersLogged < last.length) {
          lettersLogged =
            Math.ceil((last.length - lettersLogged) / 40) + lettersLogged;
          gameLog.scrollTop = gameLog.scrollHeight;
        }
      }
    }, 10);
  });

  function toggleTooltip(text) {
    tooltip.innerHTML = text;
    let classes = tooltip.classList;
    if (text) {
      classes.add("visible");
    } else {
      classes.remove("visible");
    }
  }

  function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  window.addEventListener("mousemove", async e => {
    if (menu) return;

    if (Math.abs(e.movementY) + Math.abs(e.movementX) > 2) {
      toggleTooltip(null);
      await timeout(30);
    }

    if (tooltip) {
      tooltip.style.left = e.clientX + "px";
      tooltip.style.top = e.clientY + "px";
      if (game) {
        toggleTooltip(game.tooltip);
      }
    }
  });

  window.addEventListener("keydown", e => {
    if (e.code == "Escape") {
      if (winText) {
        winText = null;
      } else {
        toggleMenu(!menu);
      }
    }

    if (e.shiftKey && e.code == "KeyR") {
      game.start();
      toggleMenu(false);
    }

    if (e.shiftKey && e.code == "KeyL") {
      toggleLanguage();
    }

    if (e.code.substr(0, 5) == "Digit") {
      let slot = e.code.substr(5);
      if (e.shiftKey) {
        game.save(slot);
        toggleMenu(false);
      } else {
        if (game.hasSave(slot)) {
          game.load(slot);
          toggleMenu(false);
        } else {
          game.log("no_save_in", slot);
        }
      }
    }
  });

  function toggleMenu(on) {
    menu = on;
    game.paused = on;
    menuDiv.style.opacity = on ? 1 : 0;
    menuDiv.style["pointer-events"] = on ? "auto" : "none";
    if (on) {
      toggleTooltip(null);
    }

    if (!on) {
      winText = null;
    }
  }

  function save(slot) {
    game.save(slot);
    toggleMenu(false);
  }

  function load(slot) {
    game.load(slot);
    toggleMenu(false);
  }

  function newGame() {
    game.start(conf);
    toggleMenu(false);
  }

  async function gameOver(text) {
    toggleMenu(true);
    winText = text;
    await tick();
    winDiv.style.opacity = 0;
    window.setTimeout(() => (winDiv.style.opacity = 1), 100);
    game.start(conf);
  }
</script>

<div class="tooltip fadein" bind:this={tooltip}>Tooltip</div>

<div class="all">

  <div class="menu" bind:this={menuDiv}>

    {#if winText}
      <div class="win" id="win" bind:this={winDiv}>
        {@html winText}
        <div style="text-align:center;">
          <button on:click={() => (winText = null)}>{lang.continue}</button>
        </div>
        <div class="win-tip">
          {@html lang.win_tip}
        </div>
      </div>
    {:else}
      <h1>Seeing Red</h1>
      <div>
        <div class="menu-table">
          <div class="menu-buttons">
            <button on:click={() => newGame()}>{lang.new_game}</button>
            {#if game && game.time > 0 && !game.complete}
              <button on:click={() => toggleMenu(false)}>
                {lang.continue}
              </button>
            {/if}
            <div style="flex-grow:1" />
            <button on:click={toggleLanguage}>{lang.lang}</button>
          </div>
          <div class="saves">
            {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as slot}
              <div class="save">
                {slot}.
                <button
                  disabled={!game || game.time == 0}
                  on:click={() => save(slot)}>
                  {lang.save}
                </button>
                <button
                  disabled={!game || !game.hasSave(slot)}
                  on:click={() => load(slot)}>
                  {lang.load}
                </button>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>

  <div class="mainer-table">
    <div class="main-table">
      <div
        class="game"
        id="game"
        on:contextmenu={e => e.preventDefault()}
        bind:this={gameDiv} />

      <div class="log" bind:this={gameLog}>
        {#if log.length > 0}
          {#each log.slice(0, log.length - 1) as record}
            <div class="record">
              {@html translated(record)}
            </div>
          {/each}
          <div class="record">
            {@html translated(log[log.length - 1]).substr(0, lettersLogged)}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
