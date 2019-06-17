import App from './App.svelte';
export let ui

window.onload = function(){

	ui = new App({
		target: document.body
  });
  
}

export default app;