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

    // 嘗試恢復 session 登入狀態
    if (!authStore.currentUser) {
        const tempUser = sessionStorage.getItem('tempUser')
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

export default router
