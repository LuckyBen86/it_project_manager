/**
 * AppLogo — icône de l'application affichée dans la navbar.
 * Pour remplacer par votre propre icône, modifiez uniquement ce composant.
 */
export default function AppLogo({ className = 'w-6 h-6' }: { className?: string }) {
  // Heroicons — rectangle-stack (outline)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-9.75 5.25L2.25 12l4.179-2.25m11.142 0L21.75 12 12 17.25 2.25 12"
      />
    </svg>
  );
}
