<script setup>
useSeoMeta({
  title: 'Minesweeper — Daily Challenge',
  ogTitle: 'Minesweeper',
  description: 'A daily minesweeper challenge with timed rankings and real-time multiplayer rooms.',
  ogDescription: 'Solve the same minefield, beat the clock, and race your friends.',
});

useHead({
  title: 'Minesweeper',
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
