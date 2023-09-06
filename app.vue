<script setup lang="ts">
useHead({
  title: 'A minesweeper game for web',
  meta: [{ name: 'minesweeper game', content: 'a minesweeper game.' }],
});
</script>
<template>
  <main
    class="py-10 text-center min-h-screen dark:bg-neutral-800 dark:text-neutral-200"
  >
    <NuxtPage></NuxtPage>
    <Footer></Footer>
  </main>
</template>
