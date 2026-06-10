<template>
  <div v-if="list.length" class="contributors-wrapper">
    <h4 class="contributors-title">{{ title }}</h4>
    <ul class="contributors-list">
      <li
        v-for="item in list"
        :key="item.login"
        class="contributors-item"
      >
        <a
          :href="item.url"
          target="_blank"
          rel="noopener noreferrer"
          :title="item.name"
        >
          <img
            class="contributors-avatar"
            :src="withBase(item.avatar)"
            :alt="item.name"
            width="40"
            height="40"
            loading="lazy"
            decoding="async"
          />
          <strong>{{ item.name }}</strong>
        </a>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

interface Contributor {
  login: string
  name: string
  avatar: string
  url: string
}

const { frontmatter } = useData()

const title = '本文贡献者'
const list = computed<Contributor[]>(() => {
  const c = frontmatter.value.contributors
  return Array.isArray(c) ? c : []
})
</script>

<style scoped>
.contributors-wrapper {
  margin-bottom: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--vp-c-divider);
}

.contributors-title {
  margin: 0 0 0.75rem;
  line-height: 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-1);
}

.contributors-list {
  display: grid;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.contributors-item {
  margin: 0;
}

.contributors-item a {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 100%;
  min-height: 66px;
  padding: 11px 16px 13px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  color: var(--vp-c-text-2);
  text-decoration: none;
  transition:
    border-color 0.25s,
    box-shadow 0.25s;
}

.contributors-avatar {
  flex: 0 0 auto;
  display: block;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--vp-c-divider);
}

.contributors-item strong {
  overflow: hidden;
  color: var(--vp-c-text-1);
  line-height: 20px;
  font-size: 14px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.contributors-item a:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 16px var(--vp-c-brand-soft);
}

@media (min-width: 640px) {
  .contributors-list {
    grid-template-columns: repeat(2, 1fr);
    column-gap: 16px;
  }
}

@media (max-width: 640px) {
  .contributors-list {
    grid-template-columns: 1fr;
  }
}
</style>
