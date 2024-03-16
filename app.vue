<script setup>
useSeoMeta({
  title: ' Minesweeper',
  ogTitle: 'Minesweeper',
  description: 'a minesweeper game powered by nuxt',
  ogDescription: 'a minesweeper game powered by nuxt',
});

useHead({
  title: 'Minesweeper',
  meta: [
    {
      name: 'google-site-verification',
      content: 'uMb53AX2NHoWvhBjQGUPiU2EvzBs2pWg90HYPMkcMP4',
    },
  ],
});
</script>
<template>
  <NuxtLoadingIndicator></NuxtLoadingIndicator>
  <main class="py-8 text-center bg-gray-100 dark:bg-gray-900 min-h-screen">
    <NuxtLayout><NuxtPage></NuxtPage></NuxtLayout>
  </main>
</template>
