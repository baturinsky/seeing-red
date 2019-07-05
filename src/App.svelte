<script>
  import { onMount, afterUpdate, tick } from "svelte";
  import { Game } from "./Game";
  import FontFaceObserver from "fontfaceobserver";

  let icons = new FontFaceObserver("Icons");
  export let log = [];

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

  while ((match = regex.exec(url))) {
    conf[match[1]] = JSON.parse(match[2]);
  }

  function updateLog(text) {
    log = game._log;
    lettersLogged = 0;
    gameLog.scrollTop = 1e6;
  }

  icons.load().then(() => {
    game = new Game();
    game.onLog = updateLog;
    game.onEnd = gameOver;
    game.init([45, 45]);
    if(game.hasSave("0")){
      game.load("0")
    } else {
      game.start(conf)
    }
    gameLog.style.height = gameDiv.clientHeight + "px";
    toggleMenu(true);
  });

  onMount(async () => {
    setInterval(() => {
      if (log && log.length > 0) {
        let last = log[log.length - 1];
        if (lettersLogged < last.length) {
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

    if (Math.abs(e.movementY) + Math.abs(e.movementX) > 3) {
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
      if(winText){
        winText = null;
      } else {
        toggleMenu(!menu);
      }
    }

    if(e.shiftKey && e.code == "KeyR"){
      game.start()
      toggleMenu(false)
    }
    if (e.code.substr(0, 5) == "Digit") {
      let slot = e.code.substr(5);
      if (e.shiftKey) {
        game.save(slot)
        toggleMenu(false)
      } else {
        if (game.hasSave(slot)) {
          game.load(slot)
          toggleMenu(false)
        } else {
          game.log("No save in " + slot);
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

    if(!on){
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
    window.setTimeout((() => winDiv.style.opacity = 1), 100)
    game.start(conf)
  }
</script>

<style>
  .log {
    vertical-align: bottom;
    font-family: Icons;
    overflow-y: auto;
    height: 100px;
    margin-left: 1px;
    width: 400px;
  }
  .main-table {
    border: 2px solid white;
    display: flex;
    padding: 1px;
    justify-content: center;
  }
  .main-table > div {
    border: 2px solid white;
  }
  .mainer-table {
    display: flex;
    justify-content:center;
  }

  .menu-table {
    display: flex;
    padding: 1px;
    justify-content: center;
  }
  .menu-table > div {
    border: 2px solid white;
  }

  .tooltip {
    position: fixed;
    z-index: 10;
    background: black;
    padding: -2px;
    transform: translate(20px, -50%);
    box-shadow: 0px 0px 10px 10px black;
    font-family: Icons;
  }
  .record {
    border-top: solid 0.5px grey;
    padding: 3px;
  }
  .menu {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: rgba(0, 0, 0, 1);
    opacity: 1;
    z-index: 3;
    font-size: 24pt;
    padding: 10px;
    text-align: center;
    font-weight: bold;
    transition: opacity 0.2s ease-in-out;
    cursor: default;
  }
  .save {
    margin: 5px;
  }
  .save button {
    width: 100px;
    padding: 3px;
  }
  .saves {
    text-align: left;
    margin-left: 1px;
  }
  h1 {
    color: red;
    font-weight: bold;
  }
  button {
    font-size: 18pt;
    font-weight: bold;
  }
  
  .win {
    text-align: left;
    font-size: 18pt;
    width:600px;
    margin: auto;
    opacity: 0;
    transition: opacity 10s ease-in-out;
  }

  .win button{
    margin-top: 50px;
    border: 1px solid white;
  }

  .all{
    overflow:hidden;
    height:100%;      
  }

  :global(.she){
    color:#ff4000;
    padding-top: 5px;
  }

  :global(.you){
    color:white;
    padding-top: 5px;
  }

  :global(.ending-type){
    margin-top: 30px;
    font-size: 24px;
    text-align: center;    
  }

  button:disabled,
  button[disabled]{
    cursor: default;
    opacity: 0.2;
    background: black;
  }
</style>

<div class="tooltip fadein" bind:this={tooltip}>Tooltip</div>

<div class="all">

<div class="menu" bind:this={menuDiv}>

  {#if winText}
    <div class="win" id="win" bind:this={winDiv}>
      {@html winText}
      <div style="text-align:center;">
        <button on:click={() => (winText = null)}>Continue</button>
      </div>
    </div>
  {:else}
    <h1>Seeing Red</h1>
    <div class="menu-table">
      <div style="text-align:center;">
        <div><button on:click={() => newGame()}>New Game</button></div>
        {#if game && game.time > 0}
          <div><button on:click={() => toggleMenu(false)}>Continue</button></div>
        {/if}
      </div>
      <div class="saves">
        {#each [1, 2, 3, 4, 5, 6, 7, 8, 9] as slot}
          <div class="save">
             {slot}.
            <button disabled={!game || game.time==0} on:click={() => save(slot)}>Save</button>
            <button disabled={!game || !game.hasSave(slot)} on:click={() => load(slot)}>Load</button>
          </div>
        {/each}
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
      {#if log.length}
        {#each log.slice(0, log.length - 1) as record}
          <div class="record">
            {@html record}
          </div>
        {/each}
        <div class="record">
          {@html log[log.length - 1].substr(0, lettersLogged)}
        </div>
      {/if}
    </div>
  </div>
</div>
</div>