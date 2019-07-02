<script>
  import { onMount } from "svelte";
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
  let tooltip;
  let lettersLogged = 0;

  while ((match = regex.exec(url))) {
    conf[match[1]] = JSON.parse(match[2]);
  }

  function updateLog(text) {
    log = game._log;
    lettersLogged = 0;
    gameLog.scrollTop = 1e6;
  }

  icons.load().then(() => {
    game = new Game(conf);
    game.onLog = updateLog;
    game.start();
    gameLog.style.height = gameDiv.clientHeight + "px";
  });

  onMount(async () => {

    setInterval(() => {
      let last = log[log.length - 1];
      if (lettersLogged < last.length) {
        lettersLogged =
          Math.ceil((last.length - lettersLogged) / 40) + lettersLogged;
        gameLog.scrollTop = gameLog.scrollHeight;
      }    
    }, 10);

  });

  function toggleTooltip(on) {
    let classes = tooltip.classList;
    if (on) {
      classes.add("visible");
    } else {
      classes.remove("visible");
    }
  }

  function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  window.addEventListener("mousemove", async e => {
    if (Math.abs(e.movementY) + Math.abs(e.movementX) > 3) {
      toggleTooltip(false);
      await timeout(30);
    }

    if (tooltip) {
      tooltip.style.left = e.clientX + "px";
      tooltip.style.top = e.clientY + "px";
      toggleTooltip(game.tooltip);
      tooltip.innerHTML = game.tooltip;
    }
  });
</script>

<style>
  .log {
    vertical-align: bottom;
    font-family: Icons;
    overflow-y: auto;
    height: 100px;
    margin-left: 1px;
    max-width: 600px;
  }
  .main-table {
    border: 2px solid white;
    display: flex;
    padding: 1px;    
  }  
  .main-table > div {
    border: 2px solid white;
  }
  .mainer-table {
    display: flex;
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
</style>

<div class="tooltip fadein" bind:this={tooltip}>Tooltip</div>

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