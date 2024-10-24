import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Laranex",
  description: "Built by Developers, for Developers",

  base: "/",
  srcDir: "src",

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config

    search: {
      provider: "local",
    },

    nav: [
      { text: "Home", link: "/" },
      { text: "About", link: "/about" },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/laranex" }],
  },
});
