// components/BlurIfLoggedOut.tsx
import AuthGate from "./AuthGate";
export default function BlurIfLoggedOut({ children, visibleWhenLoggedOut }: {children: React.ReactNode, visibleWhenLoggedOut?: React.ReactNode}) {
  return (
    <AuthGate
      fallback={
        <div className="relative">
          <div className="blur-sm select-none pointer-events-none">{children}</div>
          {visibleWhenLoggedOut && <div className="absolute inset-0 flex items-center justify-center">
            {visibleWhenLoggedOut}
          </div>}
        </div>
      }
    >
      {children}
    </AuthGate>
  );
}
