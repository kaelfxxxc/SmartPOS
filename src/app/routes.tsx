import { createBrowserRouter, Navigate } from "react-router"
import { ProtectedRoute } from "@/features/auth/ProtectedRoute"

export const router = createBrowserRouter([
  {
    path: "/",
    lazy: async () => ({
      Component: (await import("@/features/landing/LandingPage")).default,
    }),
  },
  {
    path: "/login",
    lazy: async () => ({
      Component: (await import("@/features/auth/AuthPage")).default,
    }),
  },
  {
    path: "/privacy",
    lazy: async () => ({
      Component: (await import("@/features/legal/LegalPage")).default,
    }),
  },
  {
    path: "/terms",
    lazy: async () => ({
      Component: (await import("@/features/legal/LegalPage")).default,
    }),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/onboarding",
        lazy: async () => ({
          Component: (await import("@/features/onboarding/OnboardingPage"))
            .default,
        }),
      },
      {
        path: "/app",
        lazy: async () => ({
          Component: (await import("@/features/workspace/WorkspacePage"))
            .default,
        }),
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
])
