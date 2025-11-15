export const SITE = {
  website: "https://michaelhuang.xyz",
  author: "Michael Huang",
  profile: "https://michaelhuang.xyz",
  desc: "Writings by Michael S. Huang",
  title: "mhuang74's blog",
  ogImage: "blog-cover-fractal.jpg",
  lightAndDarkMode: true,
  postPerIndex: 5,
  postPerPage: 5,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: false,
    text: "Edit page",
    url: "https://github.com/mhuang74/mhuang74.github.io/edit/main/",
  },
  dynamicOgImage: false,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "America/Los_Angeles", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
  googleAnalyticsId: "G-3VYKYSGLFF", // Google Analytics tracking ID
} as const;
