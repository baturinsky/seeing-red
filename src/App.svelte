<script>
	import { onMount } from 'svelte';
  import Game from './Game';
  import FontFaceObserver from 'fontfaceobserver'

  let icons = new FontFaceObserver('Icons');

  let conf = {}
  let hash = location.hash

  let regex = /[?&]([^=#]+)=([^&#]*)/g;
  let url = window.location.href;
  let match;
  
  while(match = regex.exec(url)) {
      conf[match[1]] = JSON.parse(match[2]);
  }  
  
  console.log(conf)

  icons.load().then(() => {
    new Game(conf)  
  })  

</script>

<style>
</style>

<div id='game'></div>
