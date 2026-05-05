<script setup>
useSeoMeta({
  title: 'Infinite Minesweeper — Multiplayer',
  ogTitle: 'Infinite Minesweeper',
  description: 'An infinite, multiplayer minesweeper game with real-time WebSocket sync. Built with Nuxt 4 + Vue 3.',
  ogDescription: 'Explore an endless minefield with friends. No boundaries, no game over — just pure survival.',
});

useHead({
  title: 'Infinite Minesweeper',
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap' },
  ],
  meta: [
    { name: 'google-site-verification', content: 'uMb53AX2NHoWvhBjQGUPiU2EvzBs2pWg90HYPMkcMP4' },
    { name: 'theme-color', content: '#171b26' },
  ],
});
</script>
<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
