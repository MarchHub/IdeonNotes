<script setup>
import { VPTeamMembers } from 'vitepress/theme'

const members = [
  {
    avatar: 'https://www.github.com/machillka.png',
    name: 'Machillka',
    title: 'Creator',
    links: [
      { icon: 'github', link: 'https://github.com/machillka' },
    ]
  },
]
</script>

# About

基于`Vitepress`制作的共享笔记库。

可以一起记录下自己所学、所经历，或许在什么时候给其他人带来点帮助（

## 维护者

<VPTeamMembers size="small" :members />
