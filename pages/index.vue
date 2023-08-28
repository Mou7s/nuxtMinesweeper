<script setup lang="ts">
interface blockstate {
  x: number;
  y: number;
  revealed?: boolean;
  mine?: boolean;
  flagged?: boolean;
  adjacentMines: number;
}

const width = 10;
const height = 10;
const state = reactive(
  Array.from({ length: height }, (_, y) =>
    Array.from(
      { length: width },
      (_, x): blockstate => ({ x, y, adjacentMines: 0 })
    )
  )
);

function generateMines() {
  for (const row of state) {
    for (const block of row) block.mine = Math.random() < 0.2;
  }
}

const directions = [
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

function updateNumbers() {
  state.forEach((row, y) => {
    row.forEach((block, x) => {
      if (block.mine) return;

      directions.forEach(([dx, dy]) => {
        const x2 = x + dx;
        const y2 = y + dy;
        if (x2 < 0 || x2 >= width || y2 < 0 || y2 >= height) return;

        if (state[y2][x2].mine) block.adjacentMines += 1;
      });
    });
  });
}

function onClick(x: number, y: number) {
  console.log(`Clicked at ${x+1} ${y+1}`);
}

generateMines();
updateNumbers();
</script>

<template>
  <div class="grid place-content-center min-h-screen text-center">
    <div v-for="(row, y) in state" :key="y">
      <button v-for="(item, x) in row" @click="onClick(x, y)" :key="x" class="w-10 h-10 border hover:bg-gray-100">
        <div v-if="item.mine" class="text-red-500">x</div>

        <div v-else>{{ item.adjacentMines }}</div>
      </button>
    </div>
  </div>
</template>
