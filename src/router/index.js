import Vue from 'vue';
import VueRouter from 'vue-router';

Vue.use(VueRouter);

const routes = [
  {
    path: '/',
    name: 'home',
    beforeEnter: () => {
        window.location.href = '/Home.html';
    },
  },
  {
    path: '/hello_world',
    name: 'hello_world',
    component: () => import('../views/HelloWorld'),
  },
  {
    path: '/crud_demo',
    name: 'crud_demo',
    component: () => import('../views/CRUD_demo.vue'),
  },
  {
    path: '/crud_remote_demo',
    name: 'crud_remote_demo',
    component: () => import('../views/CRUD_remote_demo.vue'),
  },
  {
    path: '/about',
    name: 'about',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "about" */ '../views/About.vue'),
  },
];

const router = new VueRouter({
  routes,
});

export default router;
