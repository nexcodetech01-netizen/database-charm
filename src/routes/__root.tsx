import { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { AppProviders } from "@/providers/app-providers";
import { PWAUpdateNotification } from "@/components/pwa-update-notification";
import { PwaInstallPrompt } from "@/components/pwa/install-prompt";
import { runPwaBoot } from "@/lib/pwa-boot";

import appCss from "../styles.css?url";
// build: republish to reinject managed Supabase env vars (2026-07-19)
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <img
          src="/icon-192.png"
          alt="NexOS"
          width={72}
          height={72}
          className="mx-auto mb-6 rounded-[22%] shadow-md ring-1 ring-black/5 dark:ring-white/10"
        />
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado. Você pode tentar novamente ou voltar ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" },
      { name: "theme-color", content: "#2563eb", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#0b1220", media: "(prefers-color-scheme: dark)" },
      { name: "color-scheme", content: "light dark" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "NexOS" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "application-name", content: "NexOS" },
      { name: "msapplication-TileColor", content: "#2563eb" },
      { name: "msapplication-TileImage", content: "/icon-512.png" },
      { name: "msapplication-tap-highlight", content: "no" },
      { name: "format-detection", content: "telephone=no" },
      { title: "NexOS — Modern SaaS Workspace" },
      {
        name: "description",
        content:
          "NexOS is a premium, minimal SaaS workspace built for teams that value clarity, speed, and design.",
      },
      { property: "og:title", content: "NexOS — Modern SaaS Workspace" },
      {
        property: "og:description",
        content:
          "NexOS is a premium, minimal SaaS workspace built for teams that value clarity, speed, and design.",
      },

      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "NexOS — Modern SaaS Workspace" },
      { name: "twitter:description", content: "NexOS is a premium, minimal SaaS workspace built for teams that value clarity, speed, and design." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/157c422f-2dfe-4946-ab6b-7c28c33805d1/id-preview-ebc91ba3--1a3b33ac-26b1-4f6f-8e9e-b06330eaf4a3.lovable.app-1783938828871.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/157c422f-2dfe-4946-ab6b-7c28c33805d1/id-preview-ebc91ba3--1a3b33ac-26b1-4f6f-8e9e-b06330eaf4a3.lovable.app-1783938828871.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Montserrat:wght@400;500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon", sizes: "192x192" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon", sizes: "512x512" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "apple-touch-icon", href: "/favicon.ico", sizes: "180x180" }, // Added to ensure icon shows correctly
      { rel: "manifest", href: "/manifest.webmanifest" },
      // Apple splash screens (portrait) — iOS uses these for the launch splash
      { rel: "apple-touch-startup-image", href: "/splash/apple-splash-1290-2796.png", media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/apple-splash-1179-2556.png", media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/apple-splash-1170-2532.png", media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/apple-splash-1284-2778.png", media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/apple-splash-1125-2436.png", media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/apple-splash-1242-2208.png", media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/apple-splash-750-1334.png", media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/apple-splash-2048-2732.png", media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/apple-splash-1668-2388.png", media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/apple-splash-1620-2160.png", media: "(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { rel: "apple-touch-startup-image", href: "/splash/apple-splash-1536-2048.png", media: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const themeInitScript = `(function(){try{var k='nexos-theme';var s=localStorage.getItem(k)||'system';var d=s==='dark'||(s==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(d?'dark':'light');r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

// Runs before React hydrates. A worker that controlled this navigation keeps
// intercepting requests until the page is reloaded, even after unregister().
const legacyServiceWorkerResetScript = `(function(){if(!('serviceWorker' in navigator))return;var controlled=!!navigator.serviceWorker.controller;navigator.serviceWorker.getRegistrations().then(function(registrations){if(!registrations.length)return;return Promise.allSettled(registrations.map(function(registration){return registration.unregister();})).then(function(){if(!controlled)return;try{var k='nexos:legacy-sw-reset-v2';if(sessionStorage.getItem(k)==='1')return;sessionStorage.setItem(k,'1');window.location.reload();}catch(e){window.location.reload();}});}).catch(function(){});})();`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: legacyServiceWorkerResetScript }} />
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const location = useLocation();
  const navigate = useNavigate();

  // Redirecionamento de rotas legadas (/category/$id -> /catalogo/colecao/tg-style-catalogue)
  useEffect(() => {
    if (location.pathname.startsWith("/category/")) {
      console.log("[RootComponent] Legacy route detected, redirecting to new catalog...");
      navigate({ to: "/catalogo/colecao/$slug", params: { slug: "tg-style-catalogue" }, replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    // Solo en el cliente y después de la primera renderización para evitar bloqueos de hidratación
    const timer = setTimeout(() => {
      void runPwaBoot().catch(err => {
        console.warn("[RootComponent] PWA Boot background error:", err);
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Failsafe: force clear scroll locks and pointer events on every route change
  useEffect(() => {
    // Failsafe: force clear scroll locks and pointer events on every route change
    const cleanup = () => {
      const body = document.body;
      const html = document.documentElement;
      
      let changed = false;
      if (body.style.pointerEvents || body.hasAttribute("data-scroll-locked")) {
        body.style.pointerEvents = "";
        body.removeAttribute("data-scroll-locked");
        changed = true;
      }
      
      if (html.style.pointerEvents || html.style.overflow === "hidden") {
        html.style.pointerEvents = "";
        html.style.overflow = "";
        changed = true;
      }
      
      if (changed) {
        console.log("[RootComponent] Failsafe: DOM attributes cleaned up for", location.pathname);
      }
    };

    cleanup();
    const timeoutId = setTimeout(cleanup, 50);
    return () => clearTimeout(timeoutId);
  }, [location.pathname]);

  return (
    <AppProviders queryClient={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <PwaInstallPrompt />
      <PWAUpdateNotification />
    </AppProviders>
  );
}
