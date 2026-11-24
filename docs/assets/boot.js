// Runs before first paint: marks that scripts work, so motion can start from hidden states.
// If site.js has not started within 3 s (blocked or failed), drop the mark so nothing stays hidden.
document.documentElement.classList.add('js');
setTimeout(() => { if (!document.documentElement.dataset.ready) document.documentElement.classList.remove('js'); }, 3000);
