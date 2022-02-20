<template>
  <v-app id="inspire">
    <v-navigation-drawer v-model="drawer" :clipped="$vuetify.breakpoint.lgAndUp" app>
      <v-list dense>
        <v-list-item to="/story">
          <v-list-item-action>
            <v-icon>home</v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>Our Story</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item to="/">
          <v-list-item-action>
            <v-icon>home</v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>Home</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item to="/hello_world">
          <v-list-item-action>
            <v-icon>face</v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>Hello World</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item to="/crud_demo">
          <v-list-item-action>
            <v-icon>face</v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>CRUD Demo</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item to="/crud_remote_demo">
          <v-list-item-action>
            <v-icon>face</v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>CRUD Remote Demo</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item to="/about">
          <v-list-item-action>
            <v-icon>folder</v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>About</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar
      :clipped-left="$vuetify.breakpoint.lgAndUp"
      app
      color="blue darken-3"
      dark
    >
      <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
      <v-toolbar-title
        style="width: 300px"
        class="ml-0 pl-4"
      >
        <span class="hidden-sm-and-down">Demo Vuetify App</span>
      </v-toolbar-title>
      <v-text-field
        flat
        solo-inverted
        hide-details
        prepend-inner-icon="mdi-magnify"
        label="Search"
        class="hidden-sm-and-down"
      />
      <v-spacer />
    </v-app-bar>
    <v-content>

      <v-container class="fill-height" fluid>

        <v-row align="center" justify="center">
          <router-view></router-view>
        </v-row>

      </v-container>

    </v-content>
  </v-app>
</template>

<script>
export default {
  name: 'AppView',
  props: {
    source: String,
  },
  data: () => ({
    dialog: false,
    drawer: null,
    items: [
      { icon: 'mdi-contacts', text: 'Home' },
      { icon: 'mdi-contacts', text: 'Blog' },
      { icon: 'mdi-contacts', text: 'About' },
    ],
  }),
};
</script>
