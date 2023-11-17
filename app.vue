<script setup lang="ts">
useSeoMeta({
  title: ' Minesweeper',
  ogTitle: 'Minesweeper',
  description: 'a minesweeper game powered by nuxt',
  ogDescription: 'a minesweeper game powered by nuxt',
});
</script>
<template>
  <NuxtLoadingIndicator></NuxtLoadingIndicator>
  <main
    class="py-10 text-center min-h-screen max-h-screen dark:bg-neutral-800 dark:text-neutral-200"
  >
    <NuxtPage></NuxtPage>
    <Footer></Footer>
  </main>
</template>
