/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
    // Tree-shake heavy libraries - drastically reduces module count per route
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "recharts",
      "date-fns",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-tooltip",
    ],
  },

  // Keep compiled pages in memory longer in dev mode — avoid recompiling
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000, // 1 hour (default 15s)
    pagesBufferLength: 50,           // keep 50 pages in memory (default 2)
  },
};

export default nextConfig;
