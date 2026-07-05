<template>
  <div class="about-team">
    <div class="team-grid">
      <div v-for="member in members" :key="member.github" class="team-member">
        <div class="avatar-container">
          <img :src="getAvatarUrl(member.github)" @error="handleAvatarError($event, member.github)" :alt="member.name"
            class="avatar" />
        </div>
        <div class="info">
          <a :href="`https://github.com/${member.github}`" target="_blank" rel="noopener noreferrer" class="name-link">
            <h3 class="name">{{ member.name }}</h3>
          </a>
          <p class="title" v-if="member.title">{{ member.title }}</p>
          <div class="links">
            <a :href="`https://github.com/${member.github}`" target="_blank" rel="noopener noreferrer"
              class="social-link github-link" title="GitHub">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                <path fill="currentColor"
                  d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33c.85 0 1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { withBase } from 'vitepress'

const props = defineProps({
  members: {
    type: Array,
    required: true
  }
})

// 先读 Cache
const getAvatarUrl = (github) => {
  return withBase(`/contributors/${github}.png`)
}

// Fallback
const handleAvatarError = (event, github) => {
  if (!event.target.dataset.fallback) {
    event.target.dataset.fallback = '1'
    event.target.src = `https://github.com/${github}.png`
  }
}

// TODO: 是否要做一个默认头像的 Fallback？
</script>

<style scoped>
.about-team {
  margin-top: 2rem;
}

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(224px, 1fr));
  gap: 24px;
}

.team-member {
  background-color: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition: background-color 0.25s, box-shadow 0.25s;
}

.team-member:hover {
  background-color: var(--vp-c-bg-mute);
}

.avatar-container {
  width: 96px;
  height: 96px;
  margin-bottom: 16px;
}

.avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: var(--vp-shadow-3);
}

.info {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.name-link {
  /* Let it inherit default Vitepress link styles (defined in link.css) */
  display: inline-block;
}

.name {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: inherit;
  /* Inherit link color (brand color) and hover color */
  line-height: 1.4;
}

.title {
  margin: 4px 0 12px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.links {
  display: flex;
  justify-content: center;
}

.social-link {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 32px;
  height: 32px;
  color: var(--vp-c-text-2);
  transition: color 0.25s;
  text-decoration: none !important;
  /* Cancel underline effect globally */
  border-bottom: none !important;
}

/* Ensure no underline from any custom prose styles */
:deep(.social-link),
:deep(.social-link:hover),
:deep(.social-link::after) {
  text-decoration: none !important;
  background-image: none !important;
  border: none !important;
  color: var(--vp-c-text-2) !important;
}

:deep(.social-link:hover) {
  color: var(--vp-c-text-1) !important;
}

:deep(.social-link svg) {
  fill: currentColor !important;
}

/* Retain default underline transition, but override color to grayscale and underline to brand color */
:deep(.name-link) {
  color: var(--vp-c-text-1) !important;
  background-image: linear-gradient(to right, var(--vp-c-brand-1), var(--vp-c-brand-1)) !important;
}

:deep(.name-link:hover) {
  color: var(--vp-c-text-1) !important;
  background-image: linear-gradient(to right, var(--vp-c-brand-2), var(--vp-c-brand-2)) !important;
}
</style>
