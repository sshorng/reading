import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
    {
        path: '/',
        name: 'Home',
        component: () => import('../views/Home.vue'),
        meta: { requiresAuth: true }
    },
    {
        path: '/login',
        name: 'Login',
        component: () => import('../views/Login.vue'),
    }
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes
})

router.beforeEach((to, from) => {
    const authStore = useAuthStore()

    // 嘗試恢復 session 登入狀態 (優先從 localStorage)
    if (!authStore.currentUser) {
        const tempUser = localStorage.getItem('tempUser') || sessionStorage.getItem('tempUser')
        if (tempUser) {
            authStore.setUser(JSON.parse(tempUser))
        }
    }

    if (to.meta.requiresAuth && !authStore.currentUser) {
        return { name: 'Login', query: { redirect: to.fullPath } }
    } else if (to.name === 'Login' && authStore.currentUser) {
        return { name: 'Home' }
    }
})

// 修復動態匯入失敗 (404) 的問題 - 常發生於 GitHub Pages 新版本部署時
router.onError((error, to) => {
    if (error.message.includes('Failed to fetch dynamically imported module') || error.message.includes('Importing a forbidden MIME type')) {
        console.warn('[Router] Chunk loading failed. Reloading page to fetch latest assets.')
        window.location.reload()
    }
})

export default router
