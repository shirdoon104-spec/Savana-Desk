import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./styles.css";

export const metadata: Metadata = {
  title: "Rayaan Hotel SaaS",
  description: "Offline-first hotel and restaurant management SaaS.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const clerkAppearance = {
    variables: {
      borderRadius: "8px",
      colorBackground: "#ffffff",
      colorDanger: "#b42318",
      colorForeground: "#18202a",
      colorInputBackground: "#ffffff",
      colorInputText: "#18202a",
      colorMutedForeground: "#667085",
      colorPrimary: "#0f766e",
    },
    elements: {
      cardBox: {
        boxShadow: "0 22px 60px rgba(17, 24, 39, 0.14)",
      },
      formButtonPrimary: {
        fontWeight: "700",
      },
      footerActionLink: {
        color: "#0f766e",
      },
      headerTitle: {
        color: "#18202a",
      },
    },
  };

  if (!publishableKey) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <ClerkProvider
          appearance={clerkAppearance}
          publishableKey={publishableKey}
          taskUrls={{
            "choose-organization": "/session-tasks/choose-organization",
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
