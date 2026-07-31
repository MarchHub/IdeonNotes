<script setup lang="ts">
import { data as posts } from '../post.data'

const formatDate = (timestamp: number) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

const formatDateTime = (timestamp: number) => {
    if (!timestamp) return undefined
    return new Date(timestamp).toISOString()
}
</script>

<template>
    <section class="home-posts">
        <div class="container">
            <div class="title-wrapper">
                <div class="title-deco"></div>
                <h2 class="title">RECENT_UPDATES <span class="cn-title">最近更新</span></h2>
            </div>
            <div class="grid">
                <article v-for="post in posts" :key="post.url" class="card">
                    <div class="card-top-line"></div>
                    <div class="card-header">
                        <div class="tech-dot"></div>
                        <time class="date" :datetime="formatDateTime(post.date)">{{ formatDate(post.date) }}</time>
                    </div>
                    <h3 class="card-title">
                        <a :href="post.url" class="card-link">{{ post.title }}</a>
                    </h3>
                    <div class="card-excerpt" v-html="post.excerpt"></div>
                    <div class="card-footer">
                        <span class="link-text">READ_DATA //</span>
                        <div class="icon-arrow"></div>
                    </div>
                </article>
            </div>
        </div>
    </section>
</template>

<style>
:root {
    /* 亮色模式变量 */
    --y-bg: rgba(255, 255, 255, 0.7);
    --y-border: rgba(23, 164, 212, 0.25);
    --y-title: #1e293b;
    --y-desc: #475569;
    --y-date: #7A74AB;
    --y-accent: #17A4D4;
    --y-yellow: #E8B931;
    --y-shadow: 0 10px 30px rgba(143, 139, 186, 0.1);
    --y-grad: linear-gradient(135deg, #8F8BBA 0%, #17A4D4 100%);
}

html.dark {
    --y-bg: rgba(13, 17, 23, 0.9);
    --y-border: rgba(77, 192, 232, 0.4);
    --y-title: #F8FAFC;
    --y-desc: #94A3B8;
    --y-date: #A5B4FC;
    --y-accent: #4DC0E8;
    --y-yellow: #FACC15;
    --y-shadow: 0 0 30px rgba(0, 0, 0, 0.5);
    --y-grad: linear-gradient(135deg, #A5B4FC 0%, #4DC0E8 100%);
}
</style>

<style scoped>
.home-posts {
    padding: 64px 24px;
    background-color: transparent;
}

.container {
    max-width: 1152px;
    margin: 0 auto;
}


.title-wrapper {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 40px;
}

.title-deco {
    width: 4px;
    height: 24px;
    background: var(--y-grad);
    box-shadow: 0 0 10px var(--y-accent);
}

.title {
    font-size: 24px;
    font-weight: 800;
    font-family: var(--vp-font-family-mono);
    color: var(--y-accent);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 12px;
}

.cn-title {
    font-size: 14px;
    color: var(--y-desc);
    letter-spacing: 0.1em;
}

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 28px;
}

.card {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 32px 28px;
    border-radius: 8px;
    background: var(--y-bg);
    border: 1px solid var(--y-border);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    text-decoration: none !important;
    overflow: hidden;
}

.card-link {
    color: inherit;
    text-decoration: none !important;
}

.card-link::after {
    position: absolute;
    z-index: 1;
    inset: 0;
    border-radius: 8px;
    content: '';
}

.card-link:focus {
    outline: none;
}

.card-link:focus-visible::after {
    outline: 2px solid var(--y-accent);
    outline-offset: -3px;
}

.card-excerpt :deep(a),
.card-excerpt :deep(button) {
    position: relative;
    z-index: 2;
}

.card-top-line {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--y-grad);
    transform: scaleX(0);
    transform-origin: right center;
    transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.card:hover .card-top-line {
    transform-origin: left center;
    transform: scaleX(1);
}

.card:hover {
    transform: translateY(-5px);
    border-color: var(--y-accent);
    box-shadow: var(--y-shadow);
}

.card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
}

.tech-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--y-yellow);
    box-shadow: 0 0 6px var(--y-yellow);
}

.date {
    font-family: var(--vp-font-family-mono);
    font-size: 12px;
    color: var(--y-date);
    font-weight: 700;
}

.card-title {
    margin: 0 0 12px;
    font-size: 20px;
    font-weight: 700;
    color: var(--y-title);
    line-height: 1.5;
    transition: color 0.3s;
}

.card-excerpt {
    font-size: 14px;
    color: var(--y-desc);
    line-height: 1.7;
    flex-grow: 1;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.card:hover .card-title {
    color: var(--y-accent);
}

/* 底部交互 */
.card-footer {
    margin-top: 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--y-accent);
    font-family: var(--vp-font-family-mono);
    font-weight: 800;
    font-size: 12px;
}

.icon-arrow {
    position: relative;
    width: 20px;
    height: 20px;
    transition: transform 0.3s;
}

.icon-arrow::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 2px;
    width: 12px;
    height: 2px;
    background-color: var(--y-accent);
    transform: translateY(-50%);
    transition: background-color 0.3s;
}

.icon-arrow::after {
    content: '';
    position: absolute;
    top: 50%;
    right: 2px;
    width: 6px;
    height: 6px;
    border-top: 2px solid var(--y-accent);
    border-right: 2px solid var(--y-accent);
    transform: translateY(-50%) rotate(45deg);
    transition: border-color 0.3s;
}

.card:hover .icon-arrow {
    transform: translateX(5px);
}

.card:hover .icon-arrow::before {
    background-color: var(--y-yellow);
}

.card:hover .icon-arrow::after {
    border-color: var(--y-yellow);
}
</style>
